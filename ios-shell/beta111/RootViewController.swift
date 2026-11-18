import UIKit
import WebKit

/// Loads the live GitHub Pages site. Site updates do not require a new ipa.
final class RootViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    static let siteURL = URL(string: "https://lzz202010.github.io/tom-quiz/ultimate/")!

    private var webView: WKWebView!

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.websiteDataStore = .default()
        if #available(iOS 14.0, *) {
            config.defaultWebpagePreferences.preferredContentMode = .mobile
        }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.backgroundColor = UIColor(red: 0.953, green: 0.945, blue: 0.925, alpha: 1)
        webView.isOpaque = false
        webView.allowsBackForwardNavigationGestures = true
        self.webView = webView
        self.view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: Self.siteURL))
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        // Keep the quiz site inside the shell; open unrelated links outside.
        if let host = url.host, host.hasSuffix("github.io") || host == "lzz202010.github.io" {
            decisionHandler(.allow)
            return
        }
        if url.scheme == "http" || url.scheme == "https" {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}
