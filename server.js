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
    autoRewrite: true, // OPIS'in kendi içindeki yönlendirmelerini düzeltir
    protocolRewrite: 'https',
    selfHandleResponse: true,
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('accept-encoding', 'identity');
    },
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        
        // --- SİHİRLİ DOKUNUŞ: ÇEREZ KORUMASI ---
        // OPIS'ten gelen oturum çerezlerini alıp Iframe içinde silinmemesi için mühürlüyoruz
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
        if (contentType && contentType.includes('text/html')) {
            let html = responseBuffer.toString('utf8');
            
            // Sadece Login sayfasındaysa müdahale et
            if (html.includes('Kullanıcı Adı') && html.includes('Parola')) {
                const autoLoginScript = `
                    <script>
                        document.addEventListener("DOMContentLoaded", function() {
                            setTimeout(function() {
                                let inputs = document.querySelectorAll('input');
                                
                                inputs.forEach(input => {
                                    if (input.type === 'text' && !input.value) {
                                        input.value = '${OPIS_USER}';
                                    }
                                    if (input.type === 'password' && !input.value) {
                                        input.value = '${OPIS_PASS}';
                                    }
                                });
                                
                                let loginBtn = document.getElementById('form:loginButton');
                                if (loginBtn) {
                                    loginBtn.click();
                                }
                            }, 500);
                        });
                    </script>
                `;
                html = html.replace('</body>', autoLoginScript + '</body>');
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
