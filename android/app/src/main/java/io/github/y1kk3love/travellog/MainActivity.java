package io.github.y1kk3love.travellog;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.Window;

import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

// 상태바·내비게이션 바·키보드 여백은 Capacitor 의 SystemBars 가 준다 (index.html 에 viewport-fit=cover 가 없으면
// 네이티브로 여백을 넣는다). 여기서 따로 여백을 주면 키보드 여백이 두 번 들어가므로 손대지 않는다.
// 아이콘 색은 capacitor.config.json 의 SystemBars.style(DEFAULT = 폰의 밝기 모드), 여백 자리 색은 styles.xml 의 windowBackground.
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SharePlugin.class); // 공유 글자 꺼내기 (ShareActivity 가 넘겨 준 인텐트)
        // 시스템이 앱을 정리했다가 되살리거나(savedInstanceState) 최근 앱 목록에서 다시 열면, 처음 받은 공유 인텐트가
        // 그대로 다시 들어와 예전 공유 화면이 또 열린다. 그럴 때는 평범한 시작으로 바꾼다.
        Intent intent = getIntent();
        boolean replayed = savedInstanceState != null
            || (intent != null && (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0);
        if (replayed && intent != null && Intent.ACTION_SEND.equals(intent.getAction())) {
            setIntent(new Intent(Intent.ACTION_MAIN));
        }
        super.onCreate(savedInstanceState);
        applyNightMode(getResources().getConfiguration());
    }

    // 앱이 켜진 채로 폰의 다크 모드를 켜고 끄면 시스템 바 아이콘 색과 바 뒤·WebView 배경색을 다시 맞춘다.
    // (uiMode 는 manifest 의 configChanges 에 있어 화면을 다시 만들지 않고, SystemBars 의 DEFAULT 는 켤 때 한 번만 모드를 본다)
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyNightMode(newConfig);
    }

    private void applyNightMode(Configuration config) {
        boolean night = (config.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        Window window = getWindow();
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        bars.setAppearanceLightStatusBars(!night);
        bars.setAppearanceLightNavigationBars(!night);
        int background = ContextCompat.getColor(this, R.color.app_background); // values-night 의 색이 알아서 골라진다
        window.getDecorView().setBackgroundColor(background);
        if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().setBackgroundColor(background);
    }

    // 앱이 이미 켜진 채로 공유가 들어오면(singleTask) 새 인텐트로 바꿔 둔다. 웹은 resume 때 ShareIntent.take() 로 꺼낸다.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
