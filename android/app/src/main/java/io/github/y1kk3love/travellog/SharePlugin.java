package io.github.y1kk3love.travellog;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 웹 쪽(js/native.js)에서 Capacitor.Plugins.ShareIntent.take() 로 부른다.
 * MainActivity 가 받은 공유 인텐트(글자)를 한 번 돌려주고 비운다 — 앱으로 돌아올 때마다 같은 공유가 다시 열리지 않게.
 */
@CapacitorPlugin(name = "ShareIntent")
public class SharePlugin extends Plugin {

    @PluginMethod
    public void take(PluginCall call) {
        JSObject ret = new JSObject();
        Intent intent = getActivity().getIntent();
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && intent.getType() != null && intent.getType().startsWith("text/")) {
            ret.put("type", intent.getType());
            ret.put("title", intent.getStringExtra(Intent.EXTRA_SUBJECT));
            ret.put("url", intent.getStringExtra(Intent.EXTRA_TEXT));
            getActivity().setIntent(new Intent());
        }
        call.resolve(ret);
    }
}
