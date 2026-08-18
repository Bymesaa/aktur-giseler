const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

const TARGET_IP = 'http://213.74.17.67';

// ⚠️ GİŞE MASTER KULLANICI ADI VE ŞİFRESİNİ BURAYA YAZ ⚠️
const OPIS_USER = "admin";    // Kendi gişe kullanıcı adınızı yazın
const OPIS_PASS = "ak10tur";   // Kendi gişe şifrenizi yazın

// 1. Port Ayarlama ve Yönlendirme
app.get('/set-port/:port', (req, res) => {
    const port = req.params.port;
    res.cookie('target_port', port, { 
        maxAge: 24 * 60 * 60 * 1000, 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none' 
    });
    res.redirect('/opis200/login.jsf');
});

// 2. Köprü ve Oturum (Session) Koruyucu Sistem
app.use('/', createProxyMiddleware({
    target: TARGET_IP + ':8891',
    router: function(req) {
        const port = req.cookies.target_port || '8891';
        return `${TARGET_IP}:${port}`;
    },
    changeOrigin: true,
    autoRewrite: true, 
    protocolRewrite: 'https',
    selfHandleResponse: true,
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('accept-encoding', 'identity'); // Sıkıştırmayı zorla kapat
    },
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        
        // --- ÇEREZ (OTURUM) KORUMASI ---
        let cookies = proxyRes.headers['set-cookie'];
        if (cookies) {
            let fixedCookies = cookies.map(cookie => {
                let newCookie = cookie;
                if (!newCookie.toLowerCase().includes('samesite')) {
                    newCookie += '; SameSite=None';
                }
                if (!newCookie.toLowerCase().includes('secure')) {
                    newCookie += '; Secure';
                }
                return newCookie;
            });
            res.setHeader('set-cookie', fixedCookies);
        }

        const contentType = proxyRes.headers['content-type'];
        
        // --- OTOMATİK GİRİŞ KODU ---
        if (contentType && contentType.toLowerCase().includes('text/html')) {
            let html = responseBuffer.toString('utf8');
            
            // DÜZELTME: Türkçe karakterler yerine, direkt URL ve OPIS Buton kimliğine bakıyoruz!
            if (req.url.includes('login.jsf') || html.includes('form:loginButton')) {
                const autoLoginScript = `
                    <script>
                        document.addEventListener("DOMContentLoaded", function() {
                            setTimeout(function() {
                                // PrimeFaces sınıflarına sahip veya görünür olan inputları yakala
                                let textInputs = document.querySelectorAll('input[type="text"]');
                                let passInputs = document.querySelectorAll('input[type="password"]');
                                
                                let uInput = null;
                                for(let i=0; i<textInputs.length; i++) {
                                    if(textInputs[i].className && textInputs[i].className.includes('ui-inputfield')) {
                                        uInput = textInputs[i]; break;
                                    }
                                }
                                if(!uInput && textInputs.length > 0) uInput = textInputs[0];
                                
                                let pInput = passInputs.length > 0 ? passInputs[0] : null;
                                
                                if (uInput) uInput.value = '${OPIS_USER}';
                                if (pInput) pInput.value = '${OPIS_PASS}';
                                
                                // Şifreler yazıldıktan kısa bir süre sonra butona tıkla
                                setTimeout(function() {
                                    let loginBtn = document.getElementById('form:loginButton');
                                    if (loginBtn) {
                                        loginBtn.click();
                                    }
                                }, 300);
                            }, 500);
                        });
                    </script>
                `;
                
                // Büyük/küçük harf duyarsız </body> etiketini bul ve script'i önüne ekle
                if (html.match(/<\/body>/i)) {
                    html = html.replace(/<\/body>/i, autoLoginScript + '</body>');
                } else {
                    html += autoLoginScript;
                }
            }
            return html;
        }
        return responseBuffer;
    })
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Aktur OPIS Proxy çalışıyor. Port: ${PORT}`);
});
