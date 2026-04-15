declare function acquireVsCodeApi(): any;

// 扩展 Window 接口
declare interface Window {
  markdownit: any;
  markdownitFootnote: any;
  markdownitTaskLists: any;
  DOMPurify: any;
}

(function() {
  const vscode = acquireVsCodeApi();
  let testMarkdownText = ''; // Initialize empty test markdown text
  
  let isLoading = false;
  let currentAgentMode = true;
  let md: any = null;
  let isMarkdownInitialized = false;
  
  // 初始化 markdown-it
  function initMarkdown() {
    if (isMarkdownInitialized) return;
    
    if (typeof window.markdownit !== 'undefined') {
      md = window.markdownit({
        html: false,
        xhtmlOut: false,
        breaks: false,
        langPrefix: 'language-',
        linkify: false,
        typographer: false,
        quotes: '""\'\''
      });
      
      if (typeof window.markdownitFootnote !== 'undefined') {
        md.use(window.markdownitFootnote);
      }
      
      if (typeof window.markdownitTaskLists !== 'undefined') {
        md.use(window.markdownitTaskLists);
      }
      
      isMarkdownInitialized = true;
      console.log('Markdown 初始化完成');
    }
  }
  
  // 立即尝试初始化
  initMarkdown();
  
  // 如果还没加载完成，继续轮询
  const initInterval = setInterval(() => {
    initMarkdown();
    if (isMarkdownInitialized) {
      clearInterval(initInterval);
    }
  }, 100);
  
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function addMessage(message: { role: string; content: string }) {
    const chatContainer = document.getElementById('chatContainer');
    const chatContent = chatContainer?.querySelector('.chat-content');
    const existingWelcome = chatContent?.querySelector('.welcome');
    if (existingWelcome) {
      existingWelcome.remove();
    }
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper ' + message.role;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + message.role;
    
    const roleText = message.role === 'user' ? '👤 你' : 
                     message.role === 'assistant' ? '🤖 AI' : '⚠️ 错误';
    
    const roleDiv = document.createElement('div');
    roleDiv.className = 'message-role';
    roleDiv.textContent = roleText;
    
    let contentHtml: string;
    if (message.role === 'user') {
      contentHtml = escapeHtml(message.content);
    } else {
      if (md) {
      const markdownHtml = md.render(message.content);
      contentHtml = typeof window.DOMPurify !== 'undefined' ? 
        window.DOMPurify.sanitize(markdownHtml) : escapeHtml(message.content);
    } else {
      contentHtml = escapeHtml(message.content);
    }
    }
    
    messageDiv.innerHTML = '<div class="message-content">' + contentHtml + '</div>';
    
    wrapperDiv.appendChild(roleDiv);
    wrapperDiv.appendChild(messageDiv);
    chatContent?.appendChild(wrapperDiv);
    if (chatContent) {
      chatContent.scrollTop = chatContent.scrollHeight;
    }
  }
  
  function clearMessages() {
    const chatContainer = document.getElementById('chatContainer');
    const chatContent = chatContainer?.querySelector('.chat-content');
    if (chatContent) {
      chatContent.innerHTML = '';
    }
  }
  
  function setLoading(loading: boolean) {
    isLoading = loading;
    const sendButton = document.getElementById('sendButton');
    const messageInput = document.getElementById('messageInput');
    if (sendButton) {
      (sendButton as HTMLButtonElement).disabled = loading;
    }
    if (messageInput) {
      (messageInput as HTMLTextAreaElement).disabled = loading;
    }
    
    if (sendButton) {
      if (loading) {
        sendButton.innerHTML = '<span class="loading"></span>';
      } else {
        sendButton.textContent = '发送';
      }
    }
  }
  
  function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const content = (messageInput as HTMLTextAreaElement).value.trim();
    if (!content || isLoading) return;
    
    addMessage({ role: 'user', content: content });
    vscode.postMessage({ type: 'send', content });
    (messageInput as HTMLTextAreaElement).value = '';
    setLoading(true);
  }
  
  // 绑定事件
  document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('sendButton');
    const messageInput = document.getElementById('messageInput');
    const testMarkdownBtn = document.getElementById('testMarkdownBtn');
    const configBtn = document.getElementById('configBtn');
    const modeSelect = document.getElementById('modeSelect') as HTMLSelectElement | null;
    const agentSelect = document.getElementById('agentSelect') as HTMLSelectElement | null;
    const modelSelect = document.getElementById('modelSelect') as HTMLSelectElement | null;
    const agentSelectorGroup = document.getElementById('agentSelectorGroup');
    const currentModelEl = document.getElementById('currentModel');
    
    // 发送按钮
    if (sendButton) {
      sendButton.addEventListener('click', sendMessage);
    }
    
    // Ctrl+Enter 发送
    if (messageInput) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
          sendMessage();
        }
      });
    }
    
    // 测试 Markdown
    if (testMarkdownBtn) {
      testMarkdownBtn.addEventListener('click', () => {
        addMessage({ role: 'assistant', content: testMarkdownText });
      });
    }
    
    // 配置按钮
    if (configBtn) {
      configBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openConfig' });
      });
    }
    
    // 模式切换
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        const agentMode = (e.target as HTMLSelectElement).value === 'agent';
        currentAgentMode = agentMode;
        
        if (agentSelectorGroup) {
          if (agentMode) {
            agentSelectorGroup.classList.add('visible');
          } else {
            agentSelectorGroup.classList.remove('visible');
          }
        }
        
        vscode.postMessage({ type: 'toggleAgentMode', enabled: agentMode });
      });
    }
    
    // Agent 选择器
    if (agentSelect) {
      agentSelect.addEventListener('change', (e) => {
        vscode.postMessage({ type: 'switchAgent', agentId: (e.target as HTMLSelectElement).value });
      });
    }
    
    // Model 选择器
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        vscode.postMessage({ type: 'switchModel', modelId: (e.target as HTMLSelectElement).value });
      });
    }
    
    // 消息监听
    window.addEventListener('message', (event) => {
      const message = event.data;
      
      switch (message.type) {
        case 'ready':
          // 前端已准备好，确保 markdown 已初始化
          initMarkdown();
          break;
        case 'response':
          addMessage(message.message);
          setLoading(false);
          break;
        case 'error':
          addMessage({ role: 'error', content: message.content });
          setLoading(false);
          break;
        case 'history':
          clearMessages();
          message.messages.forEach((msg: any) => addMessage(msg));
          break;
        case 'clear':
          clearMessages();
          break;
        case 'modelLoaded':
          if (message.model) {
            const modelName = message.model.modelId || message.model.id;
            const provider = message.model.protocolType || '';
            const agentMode = message.model.agentMode;
            const agentName = message.model.agentName || '默认助手';
            
            if (currentModelEl) {
              currentModelEl.textContent = modelName + (provider ? ' (' + provider + ')' : '');
              currentModelEl.style.color = 'var(--vscode-foreground)';
            }
            
            if (modeSelect) {
              modeSelect.value = agentMode ? 'agent' : 'direct';
              currentAgentMode = agentMode;
              
              // 根据模式显示/隐藏 Agent 选择器
              if (agentSelectorGroup) {
                if (agentMode) {
                  agentSelectorGroup.classList.add('visible');
                } else {
                  agentSelectorGroup.classList.remove('visible');
                }
              }
            }
            
            if (agentSelect && message.model.agentId) {
              agentSelect.value = message.model.agentId;
            }
            
            console.log('✅ 模型已加载:', { model: modelName, provider, agentMode, agentName });
          }
          break;
        case 'configLoaded':
          if (message.config) {
            const config = message.config;
            
            if (modeSelect) {
              modeSelect.value = config.agentModeEnabled ? 'agent' : 'direct';
              currentAgentMode = config.agentModeEnabled;
              
              // 根据模式显示/隐藏 Agent 选择器
              if (agentSelectorGroup) {
                if (config.agentModeEnabled) {
                  agentSelectorGroup.classList.add('visible');
                } else {
                  agentSelectorGroup.classList.remove('visible');
                }
              }
            }
            
            if (agentSelect) {
              agentSelect.value = config.currentAgent || 'default';
            }
            
            if (modelSelect && config.defaultModel) {
              modelSelect.innerHTML = '<option value="' + config.defaultModel + '">' + config.defaultModel + '</option>';
            }
          }
          break;
        case 'agentList':
          if (message.agents && Array.isArray(message.agents)) {
            if (agentSelect) {
              agentSelect.innerHTML = '';
              message.agents.forEach((agent: any) => {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = agent.name || agent.id;
                agentSelect.appendChild(option);
              });
            }
          }
          break;
        case 'modelList':
          if (message.models && Array.isArray(message.models)) {
            if (modelSelect) {
              modelSelect.innerHTML = '';
              message.models.forEach((model: any) => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name + (model.modelId ? ' (' + model.modelId + ')' : '');
                modelSelect.appendChild(option);
              });
            }
          }
          break;
        case 'setTestMarkdown':
          testMarkdownText = message.text;
          break;
      }
    });
    
    // 发送 ready 消息
    vscode.postMessage({ type: 'ready' });
  });
})();