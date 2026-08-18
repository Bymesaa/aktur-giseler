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

// 1. Port Ayarlama ve Yönlendirme (Uygulamadan buraya gelinecek)
app.get('/set-port/:port', (req, res) => {
    const port = req.params.port;
    res.cookie('target_port', port, { 
        maxAge: 24 * 60 * 60 * 1000, 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none' 
    });
    // Port hafızaya alındıktan sonra OPIS giriş sayfasına yönlendir
    res.redirect('/opis200/login.jsf');
});

// 2. Köprü (Proxy) ve Otomatik Şifre Doldurma Sistemi
app.use('/', createProxyMiddleware({
    target: TARGET_IP + ':8891', // Yedek başlangıç
    router: function(req) {
        const port = req.cookies.target_port || '8891';
        return `${TARGET_IP}:${port}`;
    },
    changeOrigin: true,
    selfHandleResponse: true,
    onProxyReq: (proxyReq, req, res) => {
        // HTML koduna müdahale edebilmek için sıkıştırmayı kapatıyoruz
        proxyReq.setHeader('accept-encoding', 'identity');
    },
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        const contentType = proxyRes.headers['content-type'];
        
        // Sadece HTML dönüyorsa içine sihirli kodumuzu enjekte ediyoruz
        if (contentType && contentType.includes('text/html')) {
            let html = responseBuffer.toString('utf8');
            
            // Eğer giriş sayfasındaysak otomatik doldurma scriptini ekle
            if (html.includes('Kullanıcı Adı') || html.includes('Parola')) {
                const autoLoginScript = `
                    <script>
                        document.addEventListener("DOMContentLoaded", function() {
                            setTimeout(function() {
                                let inputs = document.querySelectorAll('input');
                                let uFilled = false, pFilled = false;
                                
                                // Kutuları bul ve şifreleri yaz
                                inputs.forEach(input => {
                                    if (input.type === 'text' && !input.value) {
                                        input.value = '${OPIS_USER}';
                                        uFilled = true;
                                    }
                                    if (input.type === 'password' && !input.value) {
                                        input.value = '${OPIS_PASS}';
                                        pFilled = true;
                                    }
                                });
                                
                                // Her şey yazıldıysa Giriş butonuna otomatik tıkla
                                if (uFilled && pFilled) {
                                    inputs.forEach(input => {
                                        if (input.type === 'submit' || input.value.includes('Giriş')) {
                                            input.click();
                                        }
                                    });
                                }
                            }, 400); // Yarım saniyeden kısa sürede şifreyi girer ve tıklar
                        });
                    </script>
                `;
                // Kodu sayfanın en altına yapıştır
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
