import webview

if __name__ == "__main__":
    print("🚀 Abrindo foto diretamente...")
    
    # Abre a URL diretamente
    window = webview.create_window(
        title="Foto Petrobras",
        url="https://rondafotosp.petrobras.com.br/02439917.jpg",
        width=500,
        height=600,
        resizable=True
    )
    
    webview.start()
