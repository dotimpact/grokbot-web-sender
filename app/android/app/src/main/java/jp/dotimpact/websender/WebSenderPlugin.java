package jp.dotimpact.websender;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Share intent, settings storage (key encrypted with an AndroidKeyStore AES/GCM key), and close. */
@CapacitorPlugin(name = "WebSender")
public class WebSenderPlugin extends Plugin {

    private static final String PREFS = "websender";
    private static final String KEY_ALIAS = "websender-settings";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    @PluginMethod
    public void getShared(PluginCall call) {
        call.resolve(sharedFrom(getActivity().getIntent()));
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        getActivity().setIntent(intent);
        if (Intent.ACTION_SEND.equals(intent.getAction())) notifyListeners("shared", sharedFrom(intent));
    }

    private static JSObject sharedFrom(Intent intent) {
        JSObject ret = new JSObject();
        boolean isShare = intent != null && Intent.ACTION_SEND.equals(intent.getAction());
        ret.put("text", isShare ? orEmpty(intent.getStringExtra(Intent.EXTRA_TEXT)) : "");
        ret.put("subject", isShare ? orEmpty(intent.getStringExtra(Intent.EXTRA_SUBJECT)) : "");
        return ret;
    }

    @PluginMethod
    public void getSettings(PluginCall call) {
        SharedPreferences prefs = prefs();
        JSObject ret = new JSObject();
        ret.put("webhookUrl", prefs.getString("webhookUrl", ""));
        ret.put("key", decryptOrEmpty(prefs.getString("keyIv", null), prefs.getString("keyCt", null)));
        call.resolve(ret);
    }

    @PluginMethod
    public void saveSettings(PluginCall call) {
        String webhookUrl = call.getString("webhookUrl", "");
        String key = call.getString("key", "");
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey());
            byte[] ct = cipher.doFinal(key.getBytes(StandardCharsets.UTF_8));
            prefs()
                .edit()
                .putString("webhookUrl", webhookUrl)
                .putString("keyIv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString("keyCt", Base64.encodeToString(ct, Base64.NO_WRAP))
                .apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("設定を保存できませんでした");
        }
    }

    @PluginMethod
    public void close(PluginCall call) {
        call.resolve();
        getActivity().finishAndRemoveTask();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // A missing or unusable keystore entry (e.g. app data restored to another device) means the key must be re-entered.
    private String decryptOrEmpty(String iv, String ct) {
        if (iv == null || ct == null) return "";
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(ct, Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private static SecretKey secretKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        gen.init(
            new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        );
        return gen.generateKey();
    }

    private static String orEmpty(String s) {
        return s == null ? "" : s;
    }
}
