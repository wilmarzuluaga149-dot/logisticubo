package co.perla3cifras.pro;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * PERLA 3 CIFRAS PRO para Android.
 * La aplicación web va dentro del APK (carpeta assets) y se sirve desde un origen https
 * propio (https://appassets.androidplatform.net/) para que IndexedDB guarde los datos de forma
 * permanente y la actualización en línea (datos.gov.co) funcione.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String INICIO = "https://" + HOST + "/PERLA3CIFRAS_PRO.html";
    private static final int ELEGIR_ARCHIVO = 1001;
    private WebView web;
    private ValueCallback<Uri[]> archivoCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#0b1424"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b1424"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.addJavascriptInterface(new Puente(this), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String ruta = u.getPath();
                if (ruta == null || ruta.equals("/") || ruta.isEmpty()) ruta = "/PERLA3CIFRAS_PRO.html";
                try {
                    InputStream in = getAssets().open("www" + ruta);
                    String ext = MimeTypeMap.getFileExtensionFromUrl(ruta);
                    String mime = ext.equals("html") ? "text/html" : ext.equals("js") ? "application/javascript"
                            : ext.equals("svg") ? "image/svg+xml" : ext.equals("webmanifest") ? "application/manifest+json"
                            : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                    return new WebResourceResponse(mime == null ? "application/octet-stream" : mime, "utf-8", in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "No encontrado", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;  // los enlaces externos se abren en el navegador
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (archivoCallback != null) archivoCallback.onReceiveValue(null);
                archivoCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "text/csv", "text/comma-separated-values", "text/plain", "application/json", "application/octet-stream",
                        "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
                try {
                    startActivityForResult(Intent.createChooser(i, "Elegir archivo"), ELEGIR_ARCHIVO);
                } catch (Exception e) {
                    archivoCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(INICIO);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == ELEGIR_ARCHIVO && archivoCallback != null) {
            Uri[] r = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    r = new Uri[n];
                    for (int k = 0; k < n; k++) r[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) r = new Uri[]{data.getData()};
            }
            archivoCallback.onReceiveValue(r);
            archivoCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** Puente con la página: guarda los archivos exportados (Excel, PDF, copias) en Descargas. */
    private static class Puente {
        private final MainActivity act;
        Puente(MainActivity act) { this.act = act; }

        @JavascriptInterface
        public String saveFile(String nombre, String mime, String base64) {
            try {
                byte[] datos = Base64.decode(base64, Base64.DEFAULT);
                nombre = nombre.replaceAll("[\\\\/:*?\"<>|]", "_");
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PERLA3");
                    Uri uri = act.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new Exception("sin acceso a Descargas");
                    try (OutputStream os = act.getContentResolver().openOutputStream(uri)) { os.write(datos); }
                    return "Guardado en Descargas/PERLA3: " + nombre;
                } else {
                    File dir = new File(act.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "PERLA3");
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, nombre);
                    try (FileOutputStream os = new FileOutputStream(f)) { os.write(datos); }
                    return "Guardado en " + f.getAbsolutePath();
                }
            } catch (Exception e) {
                final String m = "No se pudo guardar: " + e.getMessage();
                act.runOnUiThread(new Runnable() { public void run() { Toast.makeText(act, m, Toast.LENGTH_LONG).show(); } });
                return m;
            }
        }

        @JavascriptInterface
        public String version() { return "android"; }
    }
}
