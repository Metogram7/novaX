// ======================================================================
// ========== NOVA ATLAS — script.js (HİBRİT: WEB & ELECTRON UYUMLU) ====
// ======================================================================

// 1. ORTAM KONTROLÜ (WEB'DE ÇÖKMEYİ ENGELLER)
// Normal tarayıcıda 'require' komutu olmadığı için uygulama çökebilir.
// Bunu engellemek için try-catch bloğu kullanıyoruz.
let ipcRenderer = null;
try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
} catch (e) {
    console.log("Nova Web Modunda çalışıyor (Electron API devre dışı).");
}

// --- AYARLAR ---
// Logo dosyanızın adının 'icon.png' olduğundan emin olun.
const MY_LOGO_FILE = "icon.png"; 
let myLogoData = null;

// Logo verisini sadece Electron modundaysak alıyoruz
if (ipcRenderer) {
    ipcRenderer.invoke('get-base64-logo', MY_LOGO_FILE).then(data => {
        myLogoData = data;
    }).catch(err => {
        console.error("Logo yüklenemedi:", err);
    });
}

// --------------------------------------------------
// --- BÖLÜM 1: NOVA ATLAS & SESLİ AJAN MODU ---
// --------------------------------------------------

const novaFab = document.getElementById('nova-fab');
const novaWindow = document.getElementById('nova-chat-window');
const closeNova = document.getElementById('close-nova');
const novaInput = document.getElementById('nova-input');
const sendNovaBtn = document.getElementById('send-nova'); 
const novaMessages = document.getElementById('nova-messages');
const micBtn = document.getElementById('mic-btn'); 

// --- SESLİ ASİSTAN AYARLARI ---
let recognition;
let isListening = false;

// Web Speech API hem Electron'da hem Chrome'da çalışır
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false; 
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;

    recognition.onstart = function() {
        isListening = true;
        micBtn.classList.add('listening');
        micBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        novaInput.placeholder = "Dinliyorum...";
    };

    recognition.onend = function() {
        isListening = false;
        micBtn.classList.remove('listening');
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        novaInput.placeholder = "Nova'ya bir şey sor...";
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        novaInput.value = transcript;
        setTimeout(() => sendToNova(), 500); 
    };

    recognition.onerror = function(event) {
        console.error("Ses hatası:", event.error);
        isListening = false;
        micBtn.classList.remove('listening');
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    };
} else {
    console.warn("Bu tarayıcı ses tanımayı desteklemiyor.");
    if(micBtn) micBtn.style.display = 'none';
}

function speakNova(text) {
    if (!text) return;
    window.speechSynthesis.cancel(); 

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
}

if (micBtn && recognition) {
    micBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            window.speechSynthesis.cancel(); 
            recognition.start();
        }
    });
}

if (novaFab) {
    novaFab.addEventListener('click', () => {
        novaWindow.style.display = novaWindow.style.display === 'flex' ? 'none' : 'flex';
    });
}
if (closeNova) {
    closeNova.addEventListener('click', () => {
        novaWindow.style.display = 'none';
        window.speechSynthesis.cancel(); 
    });
}

async function sendToNova() {
    const text = novaInput.value.trim();
    if (!text) return;

    addMessage('user', text);
    novaInput.value = '';

    // HİBRİT KONTROL: Eğer Web modundaysak yapay zeka backend'ine bağlanamayız.
    // Kullanıcıya bunu bildiriyoruz.
    if (!ipcRenderer) {
        const loadingId = addMessage('nova', '<i class="fa-solid fa-circle-notch fa-spin"></i> Düşünüyorum...');
        setTimeout(() => {
            const loadingMsg = document.getElementById(loadingId);
            if(loadingMsg) loadingMsg.remove();
            const msg = "Şu an Web/PWA modundasınız. Tam yapay zeka özellikleri ve tarayıcı kontrolü için lütfen masaüstü uygulamasını kullanın.";
            addMessage('nova', msg);
            speakNova("Şu an Web modundasınız.");
        }, 1000);
        return;
    }

    // ELECTRON MODU: Normal akış devam eder
    const webview = getActiveWebview();
    const currentUrl = webview ? webview.getURL() : "home";
    const pageTitle = webview ? webview.getTitle() : "Nova Başlangıç Sayfası";

    const loadingId = addMessage('nova', '<i class="fa-solid fa-circle-notch fa-spin"></i> Düşünüyorum...');

    try {
        const response = await ipcRenderer.invoke('ask-nova', { message: text, currentUrl, pageTitle });
        
        const loadingMsg = document.getElementById(loadingId);
        if(loadingMsg) loadingMsg.remove();

        const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        
        if (cleanJson.startsWith('{') && cleanJson.endsWith('}')) {
            // --- AJAN MODU ---
            const actionData = JSON.parse(cleanJson);
            
            if(actionData.speech) {
                addMessage('nova', actionData.speech);
                speakNova(actionData.speech); 
            }

            // Robot eylemi
            performAgentAction(actionData);

        } else {
            // --- NORMAL SOHBET ---
            addMessage('nova', response);
            speakNova(response); 
        }
    } catch (e) {
        console.error("Nova API Hatası:", e);
        const loadingMsg = document.getElementById(loadingId);
        if(loadingMsg) loadingMsg.innerText = "Hata oluştu. Bağlantıyı kontrol edin.";
    }
}

if(novaInput) novaInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendToNova(); });
if(sendNovaBtn) sendNovaBtn.addEventListener('click', sendToNova);

function addMessage(sender, html) {
    const id = 'msg-' + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.className = `msg ${sender}-msg`;
    div.id = id;
    div.innerHTML = html;
    novaMessages.appendChild(div);
    novaMessages.scrollTop = novaMessages.scrollHeight;
    return id;
}

// ------------------------------------------------------------
// --- KOORDİNAT HESAPLAMA (SADECE ELECTRON) ---
// ------------------------------------------------------------

async function getElementScreenCoordinates(webview, selector = null, label = null) {
    // Webview yoksa veya executeJavaScript desteklemiyorsa (Web modu) çıkış yap
    if (!webview || !webview.executeJavaScript) return { found: false };

    try {
        const result = await webview.executeJavaScript(`
            (async function() {
                function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
                if (document.readyState !== 'complete') {
                    await new Promise(resolve => window.addEventListener('load', () => resolve()));
                }

                const safeSelector = ${selector ? JSON.stringify(selector) : 'null'};
                const safeLabel = ${label ? JSON.stringify(label.toLowerCase()) : 'null'};

                let el = null;
                if (safeSelector !== 'null') {
                    try { el = document.querySelector(JSON.parse(safeSelector)); } catch(e) {}
                }

                if (!el && safeLabel !== 'null') {
                    const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea, [role="textbox"]');
                    for (const item of inputs) {
                        if (item.offsetParent !== null) {
                            if ((item.placeholder && item.placeholder.toLowerCase().includes(safeLabel)) ||
                                (item.name && item.name.toLowerCase().includes(safeLabel)) ||
                                (item.getAttribute('aria-label') && item.getAttribute('aria-label').toLowerCase().includes(safeLabel))) {
                                el = item;
                                break;
                            }
                        }
                    }
                }

                if (!el) {
                    const allInputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea, [role="textbox"]');
                    for (const item of allInputs) {
                        if (item.offsetParent !== null) {
                            el = item;
                            break;
                        }
                    }
                }

                if (!el) return { found: false };

                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(100);

                const rect = el.getBoundingClientRect();
                const scrollX = window.scrollX || document.documentElement.scrollLeft;
                const scrollY = window.scrollY || document.documentElement.scrollTop;

                return {
                    found: true,
                    x: rect.left + rect.width / 2 + scrollX,
                    y: rect.top + rect.height / 2 + scrollY + 55,
                    width: rect.width,
                    height: rect.height
                };
            })();
        `, true);

        if (result && result.found) {
            const bounds = await webview.getBoundingClientRect ? await webview.getBoundingClientRect() : { x:0, y:0 };
            return {
                found: true,
                screenX: bounds.x + result.x,
                screenY: bounds.y + result.y,
                width: result.width,
                height: result.height
            };
        } else {
            return { found: false };
        }

    } catch (err) {
        console.error("getElementScreenCoordinates Hatası:", err);
        return { found: false };
    }
}


// --- AJAN YETENEKLERİ ---
async function performAgentAction(action) {
    const webview = getActiveWebview();

    console.log("Ajan Eylemi:", action);

    // 1. NAVİGASYON
    if (action.action === 'navigate') {
        let targetUrl = action.url;
        if (targetUrl.includes('index.html') || targetUrl === 'home' || targetUrl === 'start') {
            navigateTo('home'); 
        } else {
            if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
            navigateTo(targetUrl);
        }
    }
    
    // 2. YENİ SEKME
    else if (action.action === 'new_tab') {
        createTab();
        if(action.url && action.url !== 'home') {
            navigateTo(action.url);
        }
    }

    // 3. ROBOT KONTROLLERİ (Sadece Electron'da çalışır)
    else if ((action.action === 'click' || action.action === 'type' || action.action === 'keypress') && webview) {
        
        // Web modunda bu fonksiyonlar çalışmaz, kontrol ediyoruz
        if (!ipcRenderer) {
            addMessage('nova', "Tarayıcı otomasyonu (tıklama/yazma) sadece masaüstü uygulamasında kullanılabilir.");
            return;
        }

        if (action.action === 'click' || action.action === 'type') {
            injectFakeCursor(webview, action.selector); 
        }
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (action.action === 'click' || action.action === 'type') {
                const coords = await getElementScreenCoordinates(webview, action.selector, action.label);
                
                if (coords.found) {
                    await ipcRenderer.invoke('perform-robot-action', { 
                        action: action.action, 
                        text: action.text, 
                        screenX: coords.screenX,
                        screenY: coords.screenY
                    });
                } else {
                    addMessage('nova', `**[Sistem]** Hedef bulunamadı.`);
                }
            } else if (action.action === 'keypress') {
                 await ipcRenderer.invoke('perform-robot-action', { 
                    action: 'keypress',
                    key: action.key
                });
            }
            await new Promise(resolve => setTimeout(resolve, 500)); 
            
        } catch(e) {
            console.error("Robot Hatası:", e);
        }
    }

    // 6. SCROLL (Hem Web hem Electron'da çalışır)
    else if (action.action === 'scroll' && webview) {
        if (webview.executeJavaScript) {
             webview.executeJavaScript(`
                window.scrollBy({ top: ${action.direction === 'down' ? 600 : -600}, behavior: 'smooth' });
            `);
        } else if (webview.contentWindow) {
             // Iframe için (Web Modu)
             webview.contentWindow.scrollBy({ top: (action.direction === 'down' ? 600 : -600), behavior: 'smooth' });
        }
    }
}

// Gelişmiş İmleç
function injectFakeCursor(webview, targetSelector = null) {
    if (!webview || !webview.executeJavaScript) return;

    const safeTargetSelector = targetSelector ? JSON.stringify(targetSelector) : 'null';
    let jsCode = `
    (function() {
        const cursor = document.createElement('div');
        cursor.style.position = 'fixed'; cursor.style.width = '30px'; cursor.style.height = '30px';
        cursor.style.zIndex = '999999'; 
        cursor.style.backgroundImage = 'url("https://upload.wikimedia.org/wikipedia/commons/8/83/Mouse_cursor_hand_pointer_sharp_shadow.svg")';
        cursor.style.backgroundSize = 'contain';
        cursor.style.top = '50%'; cursor.style.left = '50%'; cursor.style.transition = 'all 0.8s ease-in-out';
        cursor.style.transform = 'translate(-50%, -50%)'; 

        const oldCursor = document.getElementById('nova-cursor');
        if(oldCursor) oldCursor.remove();
        cursor.id = 'nova-cursor'; 
        
        document.body.appendChild(cursor);

        if (${safeTargetSelector} !== 'null') {
            try {
                const target = document.querySelector(JSON.parse(${safeTargetSelector}));
                if(target) {
                    const rect = target.getBoundingClientRect();
                    setTimeout(() => {
                        cursor.style.top = rect.top + window.scrollY + (rect.height/2) + 'px';
                        cursor.style.left = rect.left + window.scrollX + (rect.width/2) + 'px';
                        cursor.style.transform = 'scale(1.5) translate(-33%, -33%)'; 
                    }, 100);
                }
            } catch(e) {}
        }
        setTimeout(() => cursor.style.opacity = '0', 1200); 
        setTimeout(() => cursor.remove(), 2000); 
    })();
    `;
    webview.executeJavaScript(jsCode);
}


// --------------------------------------------------
// --- BÖLÜM 2: TARAYICI TEMEL SİSTEMİ ---
// --------------------------------------------------

let tabs = {};
let activeTabId = null;
let tabCounter = 0;

const urlInput = document.getElementById('url-input');
const newTabBtn = document.getElementById('new-tab-btn');
const homeBtn = document.getElementById('home-btn');
const goBtn = document.getElementById('go-btn');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');

init();

function init() {
    createTab();
    newTabBtn.addEventListener('click', createTab);
    homeBtn.addEventListener('click', () => navigateTo('home'));
    goBtn.addEventListener('click', handleMainSearch);
    urlInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') handleMainSearch();
    });

    backBtn.addEventListener('click', () => {
        const webview = getActiveWebview();
        if(webview) {
             if (webview.canGoBack) webview.goBack(); // Electron
             else if (webview.contentWindow) webview.contentWindow.history.back(); // Web
        }
    });
    
    forwardBtn.addEventListener('click', () => {
        const webview = getActiveWebview();
        if(webview) {
             if (webview.canGoForward) webview.goForward(); // Electron
             else if (webview.contentWindow) webview.contentWindow.history.forward(); // Web
        }
    });
    
    reloadBtn.addEventListener('click', () => {
        const webview = getActiveWebview();
        if(webview) {
             if (webview.reload) webview.reload(); // Electron
             else if (webview.contentWindow) webview.contentWindow.location.reload(); // Web
        }
    });
    
    // Robot Status (Sadece Electron)
    if (ipcRenderer) {
        ipcRenderer.on('robot-status', (event, data) => {
            console.log("Robot Durumu:", data);
            if (data.message) {
                addMessage('nova', `**[Sistem Notu]** ${data.message}`);
            }
        });
    }
}

function getActiveWebview() {
    if (!activeTabId) return null;
    const contentDiv = document.getElementById(`content-${activeTabId}`);
    // Electron için <webview>, Web için <iframe> arıyoruz
    return contentDiv ? (contentDiv.querySelector('webview') || contentDiv.querySelector('iframe')) : null;
}

// --- SEKME YÖNETİMİ ---
function createTab() {
    tabCounter++;
    const tabId = `tab-${tabCounter}`;
    
    tabs[tabId] = { id: tabId, url: 'home', title: 'Yeni Sekme' };

    const tabBtn = document.createElement('div');
    tabBtn.className = 'tab active';
    tabBtn.id = `btn-${tabId}`;
    tabBtn.innerHTML = `<span class="title">Yeni Sekme</span><span class="close-tab">✕</span>`;
    
    tabBtn.addEventListener('click', (e) => {
        if(!e.target.classList.contains('close-tab')) switchTab(tabId);
    });
    tabBtn.querySelector('.close-tab').addEventListener('click', (e) => {
        e.stopPropagation(); closeTab(tabId);
    });
    document.getElementById('tabs-container').appendChild(tabBtn);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'tab-content active';
    contentDiv.id = `content-${tabId}`;
    document.getElementById('browser-body').appendChild(contentDiv);

    switchTab(tabId);
    renderHome(tabId);
}

function switchTab(tabId) {
    if(activeTabId) {
        document.getElementById(`btn-${activeTabId}`)?.classList.remove('active');
        document.getElementById(`content-${activeTabId}`)?.classList.remove('active');
    }
    activeTabId = tabId;
    document.getElementById(`btn-${tabId}`).classList.add('active');
    document.getElementById(`content-${tabId}`).classList.add('active');
    
    const webview = getActiveWebview();
    if (tabs[tabId].url === 'home') {
        urlInput.value = '';
    } else if (webview) {
        urlInput.value = webview.src || (webview.getURL && webview.getURL()) || "";
    }
}

function closeTab(tabId) {
    if (Object.keys(tabs).length === 1) {
        navigateTo('home');
        return;
    }
    const wasActive = activeTabId === tabId;
    
    document.getElementById(`btn-${tabId}`).remove();
    document.getElementById(`content-${tabId}`).remove();
    delete tabs[tabId];
    
    if(wasActive) {
        const keys = Object.keys(tabs);
        switchTab(keys[keys.length-1]);
    }
}

// --- NAVİGASYON ---
function handleMainSearch() {
    let query = urlInput.value.trim();
    if(!query) return;

    if (query.toLowerCase() === 'home' || query.toLowerCase() === 'index.html') {
        navigateTo('home');
        return;
    }

    if (query.includes('.') && !query.includes(' ')) {
        if (!query.startsWith('http')) {
            query = 'https://' + query;
        }
        navigateTo(query);
    } else {
        navigateTo(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    }
}

window.navigateTo = function(url) {
    const tab = tabs[activeTabId];
    
    if (url === 'home' || url.includes('index.html')) {
        tab.url = 'home';
        urlInput.value = '';
        renderHome(activeTabId);
        updateTabTitle('Yeni Sekme');
        return;
    }

    tab.url = url;
    urlInput.value = url; 
    const contentDiv = document.getElementById(`content-${activeTabId}`);

    // HİBRİT YAPI: Webview veya Iframe
    let webview = getActiveWebview();
    
    if (!webview) {
        contentDiv.innerHTML = ''; 
        
        if (ipcRenderer) {
            // --- ELECTRON MODU: <webview> ---
            webview = document.createElement('webview');
            webview.setAttribute('src', url);
            webview.setAttribute('style', 'width:100%; height:100%; border:none;'); 
            webview.setAttribute('useragent', "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            webview.setAttribute('plugins', 'true');
            webview.setAttribute('allowpopups', 'true');

            // Webview Event Listeners
            webview.addEventListener('dom-ready', () => {
                if(myLogoData && webview.getURL().includes('google')) { 
                    const css = `
                        svg[viewBox="0 0 92 30"], img[alt="Google"], img[src*="googlelogo"], .lnXdpd, #hplogo, .logo img { opacity: 0 !important; pointer-events: none !important; }
                        input[value="Google'da Ara"], input[name="btnK"] { color: transparent !important; }
                        input[value="Google'da Ara"]::after, input[name="btnK"]::after { content: "Nova'da Ara"; color: #3c4043; position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
                    `;
                    webview.insertCSS(css);
                    webview.executeJavaScript(`
                        const targetEl = document.querySelector('svg[viewBox="0 0 92 30"]') || document.querySelector('img[alt="Google"]') || document.getElementById('hplogo');
                        if (targetEl && !document.getElementById('nova-replace-logo')) {
                            targetEl.style.display = "none";
                            const img = document.createElement('img'); img.src = "${myLogoData}";
                            img.style.height = "90px"; img.style.objectFit = "contain";
                            const container = document.createElement('div'); container.id = "nova-replace-logo";
                            container.style.padding = "20px 0"; container.style.margin = "0 auto"; container.style.display = "block";
                            container.appendChild(img);
                            targetEl.parentNode.insertBefore(container, targetEl);
                        }
                    `);
                }
            });

            webview.addEventListener('did-start-loading', () => { document.querySelector('.lock-icon').className = 'fa-solid fa-spinner fa-spin lock-icon'; });
            webview.addEventListener('did-stop-loading', () => {
                document.querySelector('.lock-icon').className = 'fa-solid fa-shield-halved lock-icon';
                if(activeTabId === tab.id) urlInput.value = webview.getURL();
                updateTabTitle(webview.getTitle());
            });
            webview.addEventListener('new-window', (e) => { webview.src = e.url; });

        } else {
            // --- WEB/PWA MODU: <iframe> ---
            webview = document.createElement('iframe');
            webview.setAttribute('src', url);
            webview.setAttribute('style', 'width:100%; height:100%; border:none;');
            // Not: Bazı siteler (Google vb.) iframe içinde çalışmayı güvenlik nedeniyle engeller.
        }
        
        contentDiv.appendChild(webview);
    } else {
        webview.src = url;
    }
}

function renderHome(tabId) {
    const contentDiv = document.getElementById(`content-${tabId}`);
    const template = document.getElementById('home-template');

    const existingWebview = contentDiv.querySelector('webview') || contentDiv.querySelector('iframe');
    if (existingWebview) existingWebview.remove();

    if (template) {
        const clone = template.content.cloneNode(true);
        const homeInput = clone.querySelector('.home-input');
        if (homeInput) {
            homeInput.addEventListener('keypress', (e) => {
                if(e.key === 'Enter') {
                    urlInput.value = homeInput.value;
                    handleMainSearch();
                }
            });
        }
        contentDiv.innerHTML = '';
        contentDiv.appendChild(clone);
    } else {
        contentDiv.innerHTML = '<h1 style="text-align:center; margin-top:20%;">Nova Atlas</h1>';
    }
    updateTabTitle('Yeni Sekme');
}

function updateTabTitle(title) {
    const el = document.querySelector(`#btn-${activeTabId} .title`);
    if(el) {
        el.innerText = title && title.length > 15 ? title.substring(0,12)+'...' : (title || 'Yeni Sekme');
    }
}


// ======================================================================
// ========== PWA YÜKLEME VE YÖNETİMİ (YENİ EKLENEN BÖLÜM) ============
// ======================================================================

let deferredPrompt;

// Tarayıcıda mı yoksa Yüklü Uygulama (Standalone) modunda mı?
function isRunningStandalone() {
    return (window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone);
}

// PWA Yükleme Arayüzü Oluşturucu
function createInstallUI() {
    if (document.getElementById('nova-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'nova-install-banner';
    banner.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(20, 20, 30, 0.95); border: 1px solid #00f2ff;
        box-shadow: 0 0 20px rgba(0, 242, 255, 0.3); padding: 15px 25px;
        border-radius: 12px; display: flex; align-items: center; gap: 15px;
        z-index: 10000; backdrop-filter: blur(10px); color: white; font-family: sans-serif;
    `;

    banner.innerHTML = `
        <div style="display:flex; flex-direction:column;">
            <strong style="font-size:16px; color:#00f2ff;">Nova Explore'u Yükle</strong>
            <span style="font-size:12px; opacity:0.8;">Tam ekran deneyimi için.</span>
        </div>
        <button id="nova-install-btn" style="background: #00f2ff; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">YÜKLE</button>
        <button id="nova-close-banner" style="background: transparent; border: none; color: #fff; font-size: 18px; cursor: pointer; margin-left: 5px;">✕</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('nova-close-banner').addEventListener('click', () => banner.style.display = 'none');
    
    document.getElementById('nova-install-btn').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Kullanıcı yanıtı: ${outcome}`);
            deferredPrompt = null;
            banner.style.display = 'none';
        }
    });
}

// Eğer Electron DEĞİLSE ve Standalone (PWA) DEĞİLSE yükleme teklif et
if (!ipcRenderer && !isRunningStandalone()) {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        createInstallUI();
        console.log("PWA Yükleme teklifi hazır.");
    });
}

// Service Worker Kaydı
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('Service Worker registered with scope:', registration.scope);
        }, function(err) {
            console.log('Service Worker registration failed:', err);
        });
    });
}

// ... (script.js'nin üst kısımları aynı kalsın) ...

// --- EKSİK OLAN NAVİGASYON FONKSİYONLARI ---

function handleMainSearch() {
    const query = urlInput.value.trim();
    if (!query) return;

    let targetUrl = query;
    
    // URL mi yoksa Arama mı?
    if (!targetUrl.includes('.') || targetUrl.includes(' ')) {
        targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);
    } else {
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }
    }
    
    navigateTo(targetUrl);
}

function navigateTo(url) {
    if (url === 'home') {
        renderHome(activeTabId);
        return;
    }

    tabs[activeTabId].url = url;
    const contentDiv = document.getElementById(`content-${activeTabId}`);
    contentDiv.innerHTML = ''; // Temizle

    // Eğer Electron (Masaüstü Uygulaması) modundaysak
    if (ipcRenderer) {
        const webview = document.createElement('webview');
        webview.src = url;
        webview.style.width = '100%';
        webview.style.height = '100%';
        // Google Login vb. için allowpopups gerekir
        webview.setAttribute('allowpopups', 'on'); 
        
        webview.addEventListener('did-start-loading', () => {
            if(document.getElementById(`btn-${activeTabId}`))
                document.getElementById(`btn-${activeTabId}`).querySelector('.title').innerText = "Yükleniyor...";
        });
        
        webview.addEventListener('did-stop-loading', () => {
            if(document.getElementById(`btn-${activeTabId}`))
                document.getElementById(`btn-${activeTabId}`).querySelector('.title').innerText = webview.getTitle();
            urlInput.value = webview.getURL();
        });

        contentDiv.appendChild(webview);
    } 
    // Eğer PWA / Web Tarayıcı modundaysak
    else {
        // GÜVENLİK KONTROLÜ: Google, Youtube vb. iframe içinde açılmaz.
        const blockedDomains = ['google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com'];
        const isBlocked = blockedDomains.some(domain => url.includes(domain));

        if (isBlocked) {
            contentDiv.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#333; text-align:center;">
                    <i class="fa-solid fa-shield-cat" style="font-size:64px; color:#ff5f57; margin-bottom:20px;"></i>
                    <h2>Bu site PWA modunda açılamaz</h2>
                    <p>Google ve sosyal medya siteleri güvenlik nedeniyle (X-Frame-Options) kendilerini çerçeve içine aldırmazlar.</p>
                    <p>Bu siteyi harici bir sekmede açmak için aşağıdaki butonu kullanın.</p>
                    <a href="${url}" target="_blank" style="background:#1a73e8; color:white; padding:10px 20px; text-decoration:none; border-radius:20px; margin-top:10px;">
                        Siteyi Yeni Sekmede Aç <i class="fa-solid fa-external-link-alt"></i>
                    </a>
                </div>
            `;
            urlInput.value = url;
        } else {
            // Wikipedia veya kişisel bloglar gibi izin veren siteler için IFRAME kullan
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            
            // Iframe kısıtlamalarını gevşet (Sandbox)
            iframe.sandbox = "allow-forms allow-scripts allow-same-origin allow-popups";

            contentDiv.appendChild(iframe);
            urlInput.value = url;
        }
    }
}

function renderHome(tabId) {
    tabs[tabId].url = 'home';
    tabs[tabId].title = 'Yeni Sekme';
    
    const btn = document.getElementById(`btn-${tabId}`);
    if(btn) btn.querySelector('.title').innerText = 'Yeni Sekme';

    const contentDiv = document.getElementById(`content-${tabId}`);
    contentDiv.innerHTML = '';

    const template = document.getElementById('home-template');
    const clone = template.content.cloneNode(true);
    
    // Home ekranındaki inputa enter basınca arama yapması için
    const homeInput = clone.querySelector('.home-input');
    homeInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            urlInput.value = homeInput.value; // Ana inputu güncelle
            handleMainSearch();
        }
    });

    contentDiv.appendChild(clone);
    urlInput.value = '';
}