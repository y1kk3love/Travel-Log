package io.github.y1kk3love.travellog;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

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
