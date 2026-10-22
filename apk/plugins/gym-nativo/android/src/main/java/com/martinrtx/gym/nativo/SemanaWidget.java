package com.martinrtx.gym.nativo;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Locale;
import org.json.JSONObject;

/** Tu semana: días de gym, km, peso PROMEDIO de 7 días con flecha de tendencia (nunca el del día) y sueño de anoche. */
public class SemanaWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject d = Widgets.datos(c);
        for (int id : ids) m.updateAppWidget(id, vista(c, d));
    }

    private static String num(double x) {
        return x == Math.rint(x) ? String.valueOf((long) x) : String.format(Locale.US, "%.1f", x);
    }

    static RemoteViews vista(Context c, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.w_semana);
        JSONObject s = d == null ? null : d.optJSONObject("semana");
        if (s == null) s = new JSONObject();
        v.setTextViewText(R.id.w_gym, s.optInt("gym", 0) + "/" + s.optInt("meta", 4));
        v.setTextViewText(R.id.w_km, num(s.optDouble("km", 0)));
        if (s.has("peso") && !s.isNull("peso")) {
            double cambio = s.optDouble("cambio", 0);
            String flecha = Double.isNaN(cambio) || Math.abs(cambio) < 0.05 ? " →" : cambio < 0 ? " ↓" : " ↑";
            v.setTextViewText(R.id.w_peso, num(s.optDouble("peso")) + flecha);
            int color = Double.isNaN(cambio) || Math.abs(cambio) < 0.05 ? R.color.w_texto : cambio < 0 ? R.color.w_ok : R.color.w_ambar;
            // Android 12+: el color se resuelve con el tema del momento (si cambias a modo oscuro, cambia solo)
            if (android.os.Build.VERSION.SDK_INT >= 31) v.setColorStateList(R.id.w_peso, "setTextColor", color);
            else v.setTextColor(R.id.w_peso, c.getColor(color));
        } else {
            v.setTextViewText(R.id.w_peso, "—");
        }
        if (s.has("sueno") && !s.isNull("sueno")) {
            v.setViewVisibility(R.id.w_sueno, View.VISIBLE);
            v.setTextViewText(R.id.w_sueno, "😴 " + num(s.optDouble("sueno")) + " h de sueño anoche");
        } else {
            v.setViewVisibility(R.id.w_sueno, View.GONE);
        }
        v.setOnClickPendingIntent(R.id.w_raiz, Widgets.abrir(c, "progreso", 401));
        Widgets.aviso(v, d);
        return v;
    }
}
