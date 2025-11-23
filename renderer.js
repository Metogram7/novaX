// ------------------------------------------------------------
// --- GÜNCELLENMİŞ AJAN YETENEKLERİ (SMART SELECTOR) ---
// ------------------------------------------------------------
function performAgentAction(action) {
    const webview = getActiveWebview();
    if (!webview) return;

    console.log("Ajan Eylemi:", action);

    // 1. NAVİGASYON
    if (action.action === 'navigate') {
        if (action.url.includes('index.html') || action.url === 'home') {
            navigateTo('home');
        } else {
            let targetUrl = action.url;
            if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
            navigateTo(targetUrl);
        }
    }
    
    // 2. YENİ SEKME
    else if (action.action === 'new_tab') {
        createTab();
        if (action.url && action.url !== 'home') navigateTo(action.url);
    }

    // 3. AKILLI TIKLAMA (Smart Click)
    else if (action.action === 'click') {
        // İmleç efekti
        injectFakeCursor(webview); 

        webview.executeJavaScript(`
            (function() {
                function findAndClick() {
                    // A) Önce AI'nın tahmin ettiği seçiciyi dene
                    let el = document.querySelector("${action.selector}");
                    
                    // B) Bulamazsan, METİN İÇERİĞİNE göre ara (Örn: "Giriş Yap" yazan butonu bul)
                    if (!el && "${action.label}") {
                        const searchDeep = document.querySelectorAll('button, a, span[role="button"], div[role="button"], input[type="submit"]');
                        for (let item of searchDeep) {
                            if (item.innerText && item.innerText.toLowerCase().includes("${action.label}".toLowerCase())) {
                                el = item;
                                break;
                            }
                            // Aria-label kontrolü (YouTube gibi siteler için)
                            if (item.getAttribute('aria-label') && item.getAttribute('aria-label').toLowerCase().includes("${action.label}".toLowerCase())) {
                                el = item;
                                break;
                            }
                        }
                    }

                    if (el) {
                        el.scrollIntoView({behavior: "smooth", block: "center"});
                        el.focus();
                        el.click();
                        return true;
                    }
                    return false;
                }
                findAndClick();
            })();
        `);
    }

    // 4. AKILLI YAZMA (Smart Type)
    else if (action.action === 'type') {
        injectFakeCursor(webview);

        webview.executeJavaScript(`
            (function() {
                function findAndType() {
                    // A) Önce AI'nın seçicisini dene
                    let el = document.querySelector("${action.selector}");

                    // B) Bulamazsan, sayfadaki İLK GÖRÜNÜR INPUT'u bul (Genelde arama kutusudur)
                    if (!el) {
                        const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea');
                        for (let item of inputs) {
                            // Gizli olmayan ve ekranda görünen ilk inputu al
                            if (item.offsetParent !== null) { 
                                el = item; 
                                break; 
                            }
                        }
                    }

                    if (el) {
                        el.scrollIntoView({behavior: "smooth", block: "center"});
                        el.focus();
                        el.value = ""; // Önce temizle
                        
                        // Harf harf yazıyormuş gibi simüle et (React/Vue siteleri için gerekli)
                        const text = "${action.text}";
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        nativeInputValueSetter.call(el, text);

                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        return true;
                    }
                    return false;
                }
                findAndType();
            })();
        `);
    }

    // 5. TUŞLAMA (Enter)
    else if (action.action === 'keypress') {
        if (action.key === 'Enter') {
            webview.executeJavaScript(`
                (function() {
                    const el = document.activeElement;
                    if(el) {
                        // Form içindeyse formu gönder
                        if(el.form) {
                            el.form.submit();
                        } else {
                            // Değilse Enter tuşu olayını tetikle
                            const ev = new KeyboardEvent('keydown', {
                                bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter'
                            });
                            el.dispatchEvent(ev);
                            
                            // Bazen keyup da gerekir
                            const evUp = new KeyboardEvent('keyup', {
                                bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter'
                            });
                            el.dispatchEvent(evUp);
                        }
                    }
                })();
            `);
        }
    }

    // 6. KAYDIRMA
    else if (action.action === 'scroll') {
        webview.executeJavaScript(`
            window.scrollBy({ 
                top: ${action.direction === 'down' ? 600 : -600}, 
                behavior: 'smooth' 
            });
        `);
    }
}