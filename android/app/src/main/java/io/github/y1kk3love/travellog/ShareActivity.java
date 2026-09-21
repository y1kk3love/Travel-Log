package io.github.y1kk3love.travellog;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * 공유 시트("공유 → 여행 로그")가 여는 투명 액티비티.
 * 받은 글자를 그대로 MainActivity(singleTask, 이미 켜져 있으면 그 화면)로 넘기고 바로 닫힌다.
 * 웹뷰가 하나만 살아 있어야 하므로 여기서 웹을 띄우지 않는다.
 */
public class ShareActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent incoming = getIntent();
        if (incoming != null && Intent.ACTION_SEND.equals(incoming.getAction())) {
            Intent forward = new Intent(this, MainActivity.class);
            forward.setAction(Intent.ACTION_SEND);
            forward.setType(incoming.getType());
            forward.putExtra(Intent.EXTRA_TEXT, incoming.getStringExtra(Intent.EXTRA_TEXT));
            forward.putExtra(Intent.EXTRA_SUBJECT, incoming.getStringExtra(Intent.EXTRA_SUBJECT));
            forward.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(forward);
        }
        finish();
    }
}
