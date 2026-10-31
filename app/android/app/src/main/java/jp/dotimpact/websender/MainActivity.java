package jp.dotimpact.websender;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WebSenderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
