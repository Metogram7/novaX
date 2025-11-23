// ======================================================================
// ========== NOVA ATLAS — NİHAİ main.js (TEKRAR) ========================
// ======================================================================

const { app, BrowserWindow, ipcMain, session, globalShortcut, webContents } = require("electron");
const path = require("path");
const fs = require("fs"); 
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- GERÇEK KLAVYE BASMA (robotjs) ---
const robot = require("@jitsi/robotjs"); 

// ---------------------------------------------------------------------
// !!! KENDİ GEMINI API KEY'İNİ MUTLAKA BURAYA YAZ !!!
// ---------------------------------------------------------------------
const API_KEY = "AIzaSyBfzoyaMSbSN7PV1cIhhKIuZi22ZY6bhP8"; // Burayı kendi API anahtarınızla değiştirin!

const genAI = new GoogleGenerativeAI(API_KEY);

// --- ROBOT KONTROL STATE ---
let isRobotActive = false;
let mainWindow = null; 
let ROBOT_WAIT_TIME = 1000; 

// --- NOVA SYSTEM PROMPT (Ajan Modu JSON Seti) ---
const SYSTEM_PROMPT = `
Sen Nova Atlas, gelişmiş bir web tarayıcı asistanısın.

Sadece aşağıdaki JSON formatlarından BİRİNİ döndür. Yanıtın başında ve sonunda \`\`\`json ve \`\`\` etiketlerini kullan.

1) NAVİGASYON:
{ "action": "navigate", "url": "...", "speech": "..." }

2) TIKLAMA:
{
  "action": "click",
  "selector": "...", // Mümkünse kullan. Yoksa null olabilir.
  "label": "...", // Tıklanacak butonun üzerindeki metin veya aria-label.
  "speech": "..."
}

3) YAZMA:
{
  "action": "type",
  "selector": "...", // Mümkünse kullan. Yoksa null olabilir.
  "label": "...", // Yazılacak alanın placeholder'ı veya etiketi.
  "text": "...", // Yazılacak metin
  "speech": "..."
}

4) KAYDIRMA:
{
  "action": "scroll",
  "direction": "down", // 'down' veya 'up'
  "speech": "..."
}

5) KLAVYE TUŞU:
{
  "action": "keypress",
  "key": "k", // 'Enter', 'Escape', 'tab' gibi tuşlar
  "speech": "..."
}
`;


// ======================================================================
// === WINDOW OLUŞTURMA =================================================
// ======================================================================
function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        title: "Nova Atlas Browser",
        icon: path.join(__dirname, "icon.png"),
        webPreferences: {
            webviewTag: true,
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            allowRunningInsecureContent: true
        }
    });

    win.loadFile("index.html");
    win.setMenu(null);
    mainWindow = win; 
}

// Asenkron bekleme fonksiyonu
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// ======================================================================
// === APP READY ========================================================
// ======================================================================
app.whenReady().then(() => {
    createWindow();

    // Medya izinlerini otomatik onayla (mikrofon/ses)
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ["media", "fullscreen", "notifications", "audio", "video"];

        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            callback(false);
        }
    });
    
    // Global 'S' kısayolunu dinle (Robotu Acil Durdurma)
    globalShortcut.register('S', () => {
        if (isRobotActive) {
            console.log("Global 'S' basıldı, robot kontrolü serbest bırakılıyor.");
            isRobotActive = false;
            if (mainWindow) {
                mainWindow.webContents.send('robot-status', { 
                    active: false, 
                    message: "Kullanıcı tarafından **S** tuşu ile robot kontrolü durduruldu." 
                });
            }
        }
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    globalShortcut.unregisterAll(); 
    if (process.platform !== "darwin") app.quit();
});


// ======================================================================
// === NOVA'YA SORU GÖNDER (AI) =========================================
// ======================================================================
ipcMain.handle("ask-nova", async (event, { message, currentUrl, pageTitle }) => {
    console.log(`[Kullanıcı]: ${message} | URL: ${currentUrl}`);

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: SYSTEM_PROMPT
        });

        const chat = model.startChat({}); 

        const userPrompt = `
        Şu anki durum:
        URL: ${currentUrl}
        Sayfa Başlığı: ${pageTitle}
        
        KULLANICI İSTEĞİ: ${message}
        
        Lütfen duruma en uygun olan aksiyonu seç ve sadece tek bir JSON komutunu döndür.
        `;

        const result = await chat.sendMessage(userPrompt);
        const response = result.response.text();

        console.log("[Nova Cevap]:", response);
        return response;

    } catch (err) {
        console.error("Gemini Hatası:", err);
        return "Gemini API hatası: " + err.message;
    }
});

// ======================================================================
// === LOGO YÜKLEME IPC HANDLER (Güvenlik için eklendi) =================
// ======================================================================
ipcMain.handle("get-base64-logo", async (event, filename) => {
    try {
        const imagePath = path.join(app.getAppPath(), filename); 
        if (fs.existsSync(imagePath)) {
            const bitmap = fs.readFileSync(imagePath);
            return 'data:image/png;base64,' + Buffer.from(bitmap).toString('base64');
        }
        return null;
    } catch (err) {
        console.error("Logo dosyası main süreçte bulunamadı:", err);
        return null;
    }
});


// ======================================================================
// === ROBOT EYLEMLERİ İÇİN IPC HANDLER (Sadece Robot Komutlarını Çalıştırır)
// ======================================================================
ipcMain.handle("perform-robot-action", async (event, actionData) => {
    if (isRobotActive) {
        console.warn("Robot şu anda meşgul.");
        return;
    }
    if (!mainWindow) return;

    isRobotActive = true;
    mainWindow.webContents.send('robot-status', { active: true, message: "**Robot Kontrolü Başladı.** (Durdurmak için **S**)" });

    try {
        if (actionData.action === 'click' || actionData.action === 'type') {
            
            // KOORDİNATLAR RENDERER'DAN GELİYOR (Mutlak Ekran Konumu)
            const targetX = actionData.screenX;
            const targetY = actionData.screenY;
            
            if (targetX === undefined || targetY === undefined) {
                 mainWindow.webContents.send('robot-status', { 
                    active: false, 
                    message: `**Aksiyon Başarısız:** Geçerli koordinatlar alınamadı. (Renderer hatası)`
                 });
                 return;
            }

            await sleep(500); // Fare hareketini görselleştirmek için bekle
            
            robot.moveMouse(targetX, targetY);

            if (actionData.action === 'click') {
                robot.mouseClick();

            } else if (actionData.action === 'type' && actionData.text) {
                robot.mouseClick(); // Odaklanmak için tıkla
                robot.typeString(actionData.text);
            }
        }
        
        else if (actionData.action === 'keypress' && actionData.key) {
            await sleep(500); 
            robot.keyTap(actionData.key.toLowerCase());
        }

    } catch (e) {
        console.error("Robot Eylem Hatası (RobotJS/IPC Sorunu):", e);
        mainWindow.webContents.send('robot-status', { 
            active: false, 
            message: `**Kritik Hata:** Robot kontrolü sırasında beklenmeyen bir hata oluştu.`
        });
    } finally {
        isRobotActive = false;
        mainWindow.webContents.send('robot-status', { active: false });
    }
});