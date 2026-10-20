package com.billy.pelado;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.*;
import java.util.Collections;
import java.util.Locale;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";
    private static final int OPEN_FILE = 11, SAVE_FILE = 12;
    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private byte[] pendingExport;
    private FrameLayout root;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(122,31,61));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247,247,248));
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                int top = insets.getInsets(WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout()).top;
                int bottom = Math.max(insets.getInsets(WindowInsets.Type.ime()).bottom,
                                      insets.getInsets(WindowInsets.Type.navigationBars()).bottom);
                root.setPadding(0, top, 0, bottom);
                return insets;
            });
        }
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Solo archivos concedidos por el selector de documentos; sin permisos generales.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        // El puente solo se expone a los recursos locales incluidos en la APK.
        web.addJavascriptInterface(new ExportBridge(), "PeladoAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost()) || !"GET".equals(request.getMethod())) return blocked();
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/") || path.contains("..")) return blocked();
                try {
                    InputStream stream = getAssets().open(path.substring(8));
                    WebResourceResponse response = new WebResourceResponse(mime(path), "UTF-8", stream);
                    response.setResponseHeaders(Collections.singletonMap("X-Content-Type-Options", "nosniff"));
                    return response;
                } catch (IOException e) { return blocked(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPath().startsWith("/assets/")) return false;
                if (request.hasGesture() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException e) { message("No hay navegador disponible."); }
                }
                return true;
            }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) { handler.cancel(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> result, FileChooserParams params) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = result;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, OPEN_FILE); }
                catch (ActivityNotFoundException e) { chooser.onReceiveValue(null); chooser = null; message("No hay selector de archivos disponible."); }
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String text, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(text).setPositiveButton("Aceptar", (d,w) -> result.confirm()).setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String text, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(text).setPositiveButton("Continuar", (d,w) -> result.confirm()).setNegativeButton("Cancelar", (d,w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
        });
        // Las peticiones web externas no se cargan en el WebView; las funciones son locales.
        if (Build.VERSION.SDK_INT >= 24) {
            ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setBlockNetworkLoads(true);
        }
        web.loadUrl(START);
        hideNavigation();
    }

    private void hideNavigation() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.navigationBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }
    @Override public void onWindowFocusChanged(boolean focused) { super.onWindowFocusChanged(focused); if (focused) hideNavigation(); }
    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){const b=document.querySelector('#modalRoot [data-action=\"close-modal\"]');if(b){b.click();return true;}const d=document.querySelector('#mobileDrawer.open');if(d){document.getElementById('closeDrawer').click();return true;}return false;})()", result -> {
            if (!"true".equals(result)) new AlertDialog.Builder(this).setMessage("¿Salir de Pelado? Tus registros guardados permanecerán en este teléfono.").setPositiveButton("Salir",(d,w)->finish()).setNegativeButton("Seguir",null).show();
        });
    }
    private static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if(p.endsWith(".html"))return "text/html";
        if(p.endsWith(".js"))return "text/javascript";
        if(p.endsWith(".css"))return "text/css";
        if(p.endsWith(".svg"))return "image/svg+xml";
        if(p.endsWith(".json"))return "application/json";
        return "application/octet-stream";
    }
    private static WebResourceResponse blocked() { return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0])); }
    private void message(String text) {
        runOnUiThread(() -> {
            Toast.makeText(this,text,Toast.LENGTH_LONG).show();
            web.evaluateJavascript("if(window.peladoNativeResult)window.peladoNativeResult("+JSONObject.quote(text)+")",null);
        });
    }
    public class ExportBridge {
        @JavascriptInterface public void saveFile(String encoded, String name, String type) {
            if (encoded == null || encoded.length() > 45 * 1024 * 1024) { message("Archivo demasiado grande para exportar."); return; }
            final byte[] bytes;
            try { bytes = Base64.decode(encoded,Base64.DEFAULT); }
            catch (IllegalArgumentException e) { message("No se pudo preparar el archivo."); return; }
            runOnUiThread(() -> {
                if(pendingExport != null) { message("Termina de guardar el archivo anterior."); return; }
                pendingExport = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(type != null && type.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+") ? type : "application/octet-stream");
                String safeName = name == null ? "pelado-archivo" : name.replaceAll("[\\\\/\\p{Cntrl}]", "_");
                intent.putExtra(Intent.EXTRA_TITLE,safeName);
                try { startActivityForResult(intent,SAVE_FILE); }
                catch (ActivityNotFoundException e) { pendingExport = null; message("No hay selector para guardar archivos."); }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if(request == OPEN_FILE && chooser != null) {
            Uri[] uris = result == RESULT_OK ? WebChromeClient.FileChooserParams.parseResult(result,data) : null;
            chooser.onReceiveValue(uris); chooser = null;
        }
        if(request == SAVE_FILE) {
            byte[] bytes = pendingExport; pendingExport = null;
            if(result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                Uri uri = data.getData();
                new Thread(() -> {
                    try(OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if(out == null) throw new IOException();
                        out.write(bytes); message("Archivo guardado.");
                    } catch(IOException e) { message("No se pudo guardar el archivo."); }
                }).start();
            }
        }
    }
    @Override protected void onDestroy() {
        if(chooser != null) chooser.onReceiveValue(null);
        if(web != null) { web.removeJavascriptInterface("PeladoAndroid"); root.removeView(web); web.destroy(); }
        super.onDestroy();
    }
}
