// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GUMLOOP_PROXY") {
        const fetchOptions = {
            method: request.method,
            headers: request.headers
        };
        if (request.body) fetchOptions.body = request.body;

        fetch(request.url, fetchOptions)
            .then(async (res) => {
                const text = await res.text();
                try {
                    // Try to return JSON if possible
                    return JSON.parse(text);
                } catch (e) {
                    // If server sends HTML, return the status code so we can debug
                    return { isHtmlError: true, status: res.status, body: text.substring(0, 200) };
                }
            })
            .then(data => sendResponse({ success: true, data: data }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        
        return true; 
    }
});