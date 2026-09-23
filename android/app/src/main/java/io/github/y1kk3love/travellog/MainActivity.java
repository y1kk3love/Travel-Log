package io.github.y1kk3love.travellog;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

// 상태바·내비게이션 바·키보드 여백은 Capacitor 의 SystemBars 가 준다 (index.html 에 viewport-fit=cover 가 없으면
// 네이티브로 여백을 넣는다). 여기서 따로 여백을 주면 키보드 여백이 두 번 들어가므로 손대지 않는다.
// 아이콘 색은 capacitor.config.json 의 SystemBars.style, 여백 자리 색은 styles.xml 의 windowBackground.
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SharePlugin.class); // 공유 글자 꺼내기 (ShareActivity 가 넘겨 준 인텐트)
        super.onCreate(savedInstanceState);
    }

    // 앱이 이미 켜진 채로 공유가 들어오면(singleTask) 새 인텐트로 바꿔 둔다. 웹은 resume 때 ShareIntent.take() 로 꺼낸다.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
