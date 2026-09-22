package io.github.y1kk3love.travellog;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SharePlugin.class); // 공유 글자 꺼내기 (ShareActivity 가 넘겨 준 인텐트)
        super.onCreate(savedInstanceState);
        applySystemBarInsets();
    }

    // 안드로이드 15+ 는 앱을 상태바·내비게이션 바 아래까지 펼친다(targetSdk 35+, 옵트아웃 불가).
    // 그대로 두면 상단 바와 하단 버튼이 시스템 바에 가려 눌리지 않으므로, 시스템 바·키보드 높이만큼 웹뷰에 여백을 준다.
    private void applySystemBarInsets() {
        View webView = getBridge().getWebView();
        int bg = Color.parseColor("#F2F2F7"); // css --bg. 여백 자리(상태바 뒤)에 이 색이 보인다
        webView.setBackgroundColor(bg);
        getWindow().getDecorView().setBackgroundColor(bg);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true); // 밝은 배경 → 어두운 상태바 아이콘
        controller.setAppearanceLightNavigationBars(true);
        // WebView 는 자기 padding 을 잘 반영하지 않으므로, 웹뷰를 담는 화면 컨테이너(android.R.id.content)에 여백을 준다
        View content = findViewById(android.R.id.content);
        content.setBackgroundColor(bg);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(content);
    }

    // 앱이 이미 켜진 채로 공유가 들어오면(singleTask) 새 인텐트로 바꿔 둔다. 웹은 resume 때 ShareIntent.take() 로 꺼낸다.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
