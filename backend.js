const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- API AYARLARI ---
// BURAYA KENDİ GEMINI API KEY'İNİ MUTLAKA YAZ!
const API_KEY = "AIzaSyBfzoyaMSbSN7PV1cIhhKIuZi22ZY6bhP8"; 
const genAI = new GoogleGenerativeAI(API_KEY);

// Nova Atlas'ın Kişiliği ve Ajan Komutları
const SYSTEM_PROMPT = `
Sen "Nova Explore ". Metehan Akkaya tarafından geliştirilen, Nova Browser'ın içine entegre edilmiş gelişmiş bir yapay zeka asistanısın.
Görevin: Kullanıcıya yardım etmek ve tarayıcıyı yönetmek.

ÖZEL YETENEK: "AJAN MODU" (AGENT MODE)
Eğer kullanıcı bir siteye gitmeni, kaydırmanı veya işlem yapmanı isterse, cevabını SADECE aşağıdaki JSON formatında ver. Başka bir şey yazma.

Örnekler:
User: "Youtube'u aç" -> JSON: {"action": "navigate", "url": "https://www.youtube.com", "speech": "YouTube açılıyor, kemerlerini bağla!"}
User: "Google'a git" -> JSON: {"action": "navigate", "url": "https://www.google.com", "speech": "Google'a gidiyorum."}
User: "Aşağı in" -> JSON: {"action": "scroll", "direction": "down", "speech": "Aşağı kaydırıyorum."}
User: "Yukarı çık" -> JSON: {"action": "scroll", "direction": "up", "speech": "Yukarı çıkıyorum."}

Eğer sadece sohbet ediyorsak, normal samimi bir dille cevap ver. JSON kullanma.
`;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Nova Browser",
        webPreferences: {
            webviewTag: true,      // İnternete girmek için şart
            nodeIntegration: true, // Node.js modüllerini kullanmak için
            contextIsolation: false,
            webSecurity: false     // Bazı sitelerdeki engelleri aşmak için
        }
    });

    mainWindow.loadFile("index.html");
    mainWindow.setMenu(null);
}

app.whenReady().then(() => {
    createWindow();

    // İzinleri Otomatik Onayla (Tam ekran, Video vb.)
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
    });
});

// --- GEMINI İLE İLETİŞİM ---
ipcMain.handle("ask-nova", async (event, { message, currentUrl, pageTitle }) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const contextMsg = `
        Şu anki URL: ${currentUrl}
        Şu anki Başlık: ${pageTitle}
        Kullanıcı Mesajı: ${message}
        `;

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                { role: "model", parts: [{ text: "Anlaşıldı. Nova Atlas devrede." }] }
            ]
        });

        const result = await chat.sendMessage(contextMsg);
        const response = result.response.text();
        return response;

    } catch (error) {
        console.error("AI Hatası:", error);
        return "Üzgünüm, şu an bağlantımda bir sorun var. API anahtarını kontrol eder misin?";
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});