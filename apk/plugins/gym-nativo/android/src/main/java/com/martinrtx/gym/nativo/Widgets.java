package com.martinrtx.gym.nativo;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.SweepGradient;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Lo que comparten los widgets: los datos que guarda la app, la cola de comidas que se agregan
 * desde el widget de proteína y los atajos para abrir la app en una sección.
 */
final class Widgets {

    static final String ESQUEMA = "gymmb";
    private static final String PREFS = "gym_widgets";
    private static final long UN_DIA = 24L * 60 * 60 * 1000;
    private static final Class<?>[] TODOS = { ProteinaWidget.class, HoyWidget.class, CarreraWidget.class, SemanaWidget.class };

    private Widgets() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void guardarDatos(Context c, String json) {
        prefs(c).edit().putString("datos", json).apply();
    }

    /** Lo último que guardó la app, o null si nunca se ha abierto. */
    static JSONObject datos(Context c) {
        String s = prefs(c).getString("datos", null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    /** Más de un día sin abrir la app: el widget pide abrirla. */
    static boolean viejo(JSONObject d) {
        return d == null || System.currentTimeMillis() - d.optLong("ts", 0) > UN_DIA;
    }

    static String hoy() {
        return LocalDate.now().toString();
    }

    /* ----- Cola de comidas agregadas desde el widget: la app la toma al abrirse y la sube a la hoja ----- */

    static synchronized JSONArray cola(Context c) {
        try {
            return new JSONArray(prefs(c).getString("cola", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static synchronized void agregarACola(Context c, String k, int g) {
        JSONArray q = cola(c);
        try {
            JSONObject x = new JSONObject();
            x.put("id", UUID.randomUUID().toString());
            x.put("k", k);
            x.put("g", g);
            x.put("dia", hoy());
            x.put("ts", System.currentTimeMillis());
            q.put(x);
        } catch (JSONException e) {
            return;
        }
        prefs(c).edit().putString("cola", q.toString()).apply();
    }

    static synchronized JSONArray tomarCola(Context c) {
        JSONArray q = cola(c);
        prefs(c).edit().remove("cola").apply();
        return q;
    }

    static int gramosEnCola(Context c, String dia) {
        JSONArray q = cola(c);
        int g = 0;
        for (int i = 0; i < q.length(); i++) {
            JSONObject x = q.optJSONObject(i);
            if (x != null && dia.equals(x.optString("dia"))) g += x.optInt("g", 0);
        }
        return g;
    }

    /* ----- Actualizar y abrir ----- */

    /** Vuelve a pintar los widgets que estén en la pantalla de inicio (después de cada guardado en la app). */
    static void actualizarTodos(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> cls : TODOS) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, cls));
            if (ids == null || ids.length == 0) continue;
            Intent i = new Intent(c, cls).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            c.sendBroadcast(i);
        }
    }

    /** Abre la app en una sección: gymmb://accion/entrenar, /comida, /peso, /trote, /progreso. */
    static PendingIntent abrir(Context c, String accion, int codigo) {
        Intent i = intentAccion(c, accion);
        return PendingIntent.getActivity(c, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static Intent intentAccion(Context c, String accion) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(ESQUEMA + "://accion/" + accion));
        Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (launch != null && launch.getComponent() != null) i.setComponent(launch.getComponent());
        else i.setPackage(c.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return i;
    }

    /** "Abre la app para actualizar" cuando los datos tienen más de un día. */
    static void aviso(RemoteViews v, JSONObject d) {
        v.setViewVisibility(R.id.w_aviso, viejo(d) ? View.VISIBLE : View.GONE);
    }

    /** Anillo de progreso dibujado (los widgets no pueden usar vistas propias). */
    static Bitmap anillo(Context c, float pct) {
        int lado = 240;
        float grosor = 24f, m = grosor / 2f + 2f;
        Bitmap b = Bitmap.createBitmap(lado, lado, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        RectF r = new RectF(m, m, lado - m, lado - m);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(grosor);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setColor(c.getColor(R.color.w_pista));
        cv.drawArc(r, 0, 360, false, p);
        float f = Math.max(0f, Math.min(1f, pct));
        if (f > 0f) {
            p.setShader(new SweepGradient(lado / 2f, lado / 2f, new int[] { 0xFF06B6D4, 0xFF4ADE80, 0xFF06B6D4 }, new float[] { 0f, 0.6f, 1f }));
            cv.save();
            cv.rotate(-90f, lado / 2f, lado / 2f);
            cv.drawArc(r, 0, 360f * f, false, p);
            cv.restore();
        }
        return b;
    }
}
