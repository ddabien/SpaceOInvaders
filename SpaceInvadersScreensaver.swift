import Cocoa
import ScreenSaver
import WebKit

@available(macOS 13.0, *)
final class SpaceInvadersScreensaverView: ScreenSaverView, WKNavigationDelegate {

    private var webView: WKWebView!
    private var hasLoaded = false

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)

        let config = WKWebViewConfiguration()

        // Permitir autoplay de audio
        if #available(macOS 10.15, *) {
            config.mediaTypesRequiringUserActionForPlayback = []
        }

        let webpagePrefs = WKWebpagePreferences()
        webpagePrefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = webpagePrefs

        // CRÍTICO: Permitir acceso a archivos locales
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        
        // Desactivar cache para evitar problemas
        config.websiteDataStore = WKWebsiteDataStore.nonPersistent()

        webView = WKWebView(frame: bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.underPageBackgroundColor = .black
        webView.navigationDelegate = self
        
        // CRÍTICO: Hacer el webview opaco
        webView.setValue(false, forKey: "drawsBackground")

        addSubview(webView)
        loadGame()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    private func loadGame() {
        let bundle = Bundle(for: type(of: self))

        guard let htmlURL = bundle.url(forResource: "index", withExtension: "html") else {
            NSLog("❌ SpaceInvaders: No se encontró index.html")
            return
        }

        let resourcesURL = htmlURL.deletingLastPathComponent()
        
        NSLog("✅ SpaceInvaders: Cargando desde: \(htmlURL.path)")
        
        // Cargar el HTML
        webView.loadFileURL(htmlURL, allowingReadAccessTo: resourcesURL)
    }

    override func draw(_ rect: NSRect) {
        NSColor.black.setFill()
        rect.fill()
    }

    override func startAnimation() {
        super.startAnimation()
        if !hasLoaded {
            loadGame()
        }
    }

    override func stopAnimation() {
        super.stopAnimation()
    }

    override var hasConfigureSheet: Bool { false }

    // WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasLoaded = true
        NSLog("✅ SpaceInvaders: WebView cargado exitosamente")
        
        // SOLUCIÓN: Forzar resize del canvas después de cargar
        let js = """
        (function() {
            console.log('🎮 Forzando inicio del juego...');
            const canvas = document.getElementById('c');
            if (canvas) {
                console.log('✅ Canvas encontrado');
                // Forzar evento resize para inicializar el canvas
                window.dispatchEvent(new Event('resize'));
                // Verificar que el canvas tiene tamaño
                setTimeout(function() {
                    console.log('📏 Canvas width:', canvas.width, 'height:', canvas.height);
                    if (canvas.width === 0 || canvas.height === 0) {
                        console.warn('⚠️ Canvas sin dimensiones, forzando...');
                        window.dispatchEvent(new Event('resize'));
                    }
                }, 100);
            } else {
                console.error('❌ Canvas no encontrado!');
            }
        })();
        """
        
        webView.evaluateJavaScript(js) { result, error in
            if let error = error {
                NSLog("❌ Error ejecutando JS: \(error)")
            } else {
                NSLog("✅ JavaScript ejecutado correctamente")
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        NSLog("❌ SpaceInvaders: Error en navegación: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("❌ SpaceInvaders: Error provisional: \(error.localizedDescription)")
    }
}
