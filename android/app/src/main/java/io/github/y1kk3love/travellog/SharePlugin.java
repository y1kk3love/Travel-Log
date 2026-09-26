package io.github.y1kk3love.travellog;

import android.content.ComponentName;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * 웹 쪽(js/native.js)에서 Capacitor.Plugins.ShareIntent.take() / resolveLink() 로 부른다.
 * take: MainActivity 가 받은 공유 인텐트(글자)를 한 번 돌려주고 비운다 — 앱으로 돌아올 때마다 같은 공유가 다시 열리지 않게.
 * resolveLink: 구글 지도 앱의 짧은 링크(maps.app.goo.gl)를 따라가 긴 구글 지도 주소를 돌려준다.
 *   웹뷰의 fetch 는 CORS 때문에 리디렉트 주소를 볼 수 없어서 네이티브에서 한다.
 */
@CapacitorPlugin(name = "ShareIntent")
public class SharePlugin extends Plugin {

    // 따라갈 수 있는 짧은 링크 주소 (이 밖의 주소로는 요청하지 않는다)
    private static final Set<String> SHORT_HOSTS = new HashSet<>(Arrays.asList("maps.app.goo.gl", "goo.gl", "g.co"));
    private static final int MAX_HOPS = 5;
    private static final int TIMEOUT_MS = 5000;

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

    // 초대 메시지 등 글을 안드로이드 공유 창으로 보낸다. 이 앱도 글 공유를 받으므로 목록에서 자신은 뺀다.
    @PluginMethod
    public void shareText(PluginCall call) {
        String text = call.getString("text", "");
        String title = call.getString("title", "");
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        if (!title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
        Intent chooser = Intent.createChooser(send, title.isEmpty() ? null : title);
        chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, new ComponentName[] { new ComponentName(getContext(), ShareActivity.class) });
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(chooser);
                call.resolve();
            } catch (Exception e) {
                call.reject("공유 창을 열지 못했어요", e);
            }
        });
    }

    @PluginMethod
    public void resolveLink(PluginCall call) {
        String start = call.getString("url");
        // 네트워크는 UI 스레드에서 쓸 수 없다
        new Thread(() -> {
            JSObject ret = new JSObject();
            try {
                String resolved = follow(start);
                if (resolved != null) ret.put("url", resolved);
            } catch (Exception e) {
                // 오프라인·시간 초과 등: url 없이 돌려주면 웹이 이름 검색으로 넘어간다
            }
            call.resolve(ret);
        }).start();
    }

    // 짧은 링크 주소인 동안만 한 단계씩 요청해 Location 헤더를 읽는다 (본문은 받지 않는다).
    // 구글 지도 주소에 닿으면 그 주소, 다른 곳이면 null.
    private static String follow(String start) throws Exception {
        if (start == null) return null;
        String current = start;
        for (int hop = 0; hop < MAX_HOPS; hop++) {
            URL url = new URL(current);
            if (!"https".equals(url.getProtocol())) return null;
            if (isGoogleMaps(url)) return current;
            if (!SHORT_HOSTS.contains(url.getHost())) return null;
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            try {
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(TIMEOUT_MS);
                conn.setReadTimeout(TIMEOUT_MS);
                int code = conn.getResponseCode();
                String location = conn.getHeaderField("Location");
                if (code < 300 || code >= 400 || location == null) return null;
                current = new URL(url, location).toString();
            } finally {
                conn.disconnect();
            }
        }
        URL last = new URL(current);
        return "https".equals(last.getProtocol()) && isGoogleMaps(last) ? current : null;
    }

    // www.google.com/maps…, google.co.kr/maps…, maps.google.com/…
    private static boolean isGoogleMaps(URL url) {
        String host = url.getHost();
        String path = url.getPath() == null ? "" : url.getPath();
        boolean google = host.matches("(www\\.)?google\\.[a-z.]+");
        return (google && path.startsWith("/maps")) || host.matches("maps\\.google\\.[a-z.]+");
    }
}
