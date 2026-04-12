// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔵 DOM 加载完成');
  
  const vscode = acquireVsCodeApi();
  const chatContainer = document.getElementById('chatContainer');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const currentModelEl = document.getElementById('currentModel');
  const testMarkdownBtn = document.getElementById('testMarkdownBtn');
  
  // 新增：控制栏元素
  const modeSelect = document.getElementById('modeSelect');
  const agentSelect = document.getElementById('agentSelect');
  const modelSelect = document.getElementById('modelSelect');
  const agentSelectorGroup = document.getElementById('agentSelectorGroup');
  const configBtn = document.getElementById('configBtn');

  console.log('🔵 按钮元素:', testMarkdownBtn);

  let isLoading = false;
  let currentAgentMode = true; // 默认 Agent 模式启用

  // 引入 markdown-it 和 DOMPurify (通过 CDN)
  const markdownItScript = document.createElement('script');
  markdownItScript.src = 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js';
  document.head.appendChild(markdownItScript);

  const markdownItFootnoteScript = document.createElement('script');
  markdownItFootnoteScript.src = 'https://cdn.jsdelivr.net/npm/markdown-it-footnote@3.0.3/dist/markdown-it-footnote.min.js';
  document.head.appendChild(markdownItFootnoteScript);

  const markdownItTaskListsScript = document.createElement('script');
  markdownItTaskListsScript.src = 'https://cdn.jsdelivr.net/npm/markdown-it-task-lists@2.1.1/dist/markdown-it-task-lists.min.js';
  document.head.appendChild(markdownItTaskListsScript);

  const dompurifyScript = document.createElement('script');
  dompurifyScript.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js';
  document.head.appendChild(dompurifyScript);

  // 初始化 markdown-it
  let md = null;
  const initInterval = setInterval(() => {
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
      
      // 启用脚注插件
      if (typeof window.markdownitFootnote !== 'undefined') {
        md.use(window.markdownitFootnote);
      }
      
      // 启用任务列表插件
      if (typeof window.markdownitTaskLists !== 'undefined') {
        md.use(window.markdownitTaskLists);
      }
      
      console.log('✅ markdown-it 初始化完成');
      clearInterval(initInterval);
    }
  }, 100);

  // 测试 Markdown 的示例文本（从全局变量获取）
  const testMarkdownText = window.testMarkdownText || '# Markdown 测试文本\n\n加载失败';

  function addMessage(message) {
    const existingWelcome = chatContainer.querySelector('.welcome');
    if (existingWelcome) {
      existingWelcome.remove();
    }

    // 创建外层包装器
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper ' + message.role;
    
    // 创建消息气泡
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + message.role;
    
    const roleText = message.role === 'user' ? '👤 你' : 
                     message.role === 'assistant' ? '🤖 AI' : '⚠️ 错误';
    
    // 创建角色标签
    const roleDiv = document.createElement('div');
    roleDiv.className = 'message-role';
    roleDiv.textContent = roleText;
    
    // 用户消息直接显示，AI 消息渲染 Markdown
    let contentHtml;
    if (message.role === 'user') {
      contentHtml = escapeHtml(message.content);
    } else {
      // 使用 markdown-it 渲染 Markdown，然后用 DOMPurify 清理 XSS
      if (md) {
        const markdownHtml = md.render(message.content);
        contentHtml = typeof DOMPurify !== 'undefined' ? 
          DOMPurify.sanitize(markdownHtml) : escapeHtml(message.content);
      } else {
        // 库未加载时，使用简单的转义
        contentHtml = escapeHtml(message.content);
      }
    }
    
    messageDiv.innerHTML = `<div class="message-content">${contentHtml}</div>`;
    
    // 添加元素到包装器（先标签，后对话框）
    wrapperDiv.appendChild(roleDiv);
    wrapperDiv.appendChild(messageDiv);
    
    chatContainer.appendChild(wrapperDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function clearMessages() {
    chatContainer.innerHTML = '';
  }

  function setLoading(loading) {
    isLoading = loading;
    sendButton.disabled = loading;
    messageInput.disabled = loading;
    
    if (loading) {
      sendButton.innerHTML = '<span class="loading"></span>';
    } else {
      sendButton.textContent = '发送';
    }
  }

  function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || isLoading) return;

    // 立即在前端显示用户消息
    addMessage({
      role: 'user',
      content: content
    });

    vscode.postMessage({ type: 'send', content });
    messageInput.value = '';
    setLoading(true);
  }

  sendButton.addEventListener('click', sendMessage);

  messageInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      sendMessage();
    }
  });

  // 测试 Markdown 按钮
  if (testMarkdownBtn) {
    testMarkdownBtn.addEventListener('click', () => {
      console.log('🧪 点击了测试 Markdown 按钮');
      // 直接添加测试消息
      addMessage({
        role: 'assistant',
        content: testMarkdownText
      });
      console.log('🧪 Markdown 测试文本已添加');
    });
    console.log('✅ 测试 Markdown 按钮事件已绑定');
  } else {
    console.error('❌ 找不到测试 Markdown 按钮元素');
  }

  // 配置按钮
  console.log('🔵 配置按钮元素:', configBtn);
  if (configBtn) {
    configBtn.addEventListener('click', () => {
      console.log('⚙️ 点击了配置按钮');
      console.log('⚙️ 发送 openConfig 消息');
      vscode.postMessage({ type: 'openConfig' });
    });
    console.log('✅ 配置按钮事件已绑定');
  } else {
    console.error('❌ 找不到配置按钮元素');
  }

  // 模式切换选择器
  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      const agentMode = e.target.value === 'agent';
      currentAgentMode = agentMode;
      
      // 显示/隐藏 Agent 选择器
      if (agentMode) {
        agentSelectorGroup.classList.add('visible');
      } else {
        agentSelectorGroup.classList.remove('visible');
      }
      
      // 发送消息到后端
      vscode.postMessage({ type: 'toggleAgentMode', enabled: agentMode });
      console.log('🔄 切换到', agentMode ? 'Agent 模式' : '直接模式');
    });
    console.log('✅ 模式切换选择器已绑定');
  } else {
    console.error('❌ 找不到模式选择器元素');
  }

  // Agent 选择器
  if (agentSelect) {
    agentSelect.addEventListener('change', (e) => {
      vscode.postMessage({ type: 'switchAgent', agentId: e.target.value });
      console.log('🤖 切换到 Agent:', e.target.value);
    });
    console.log('✅ Agent 选择器已绑定');
  } else {
    console.error('❌ 找不到 Agent 选择器元素');
  }

  // Model 选择器
  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      vscode.postMessage({ type: 'switchModel', modelId: e.target.value });
      console.log('📦 切换到 Model:', e.target.value);
    });
    console.log('✅ Model 选择器已绑定');
  } else {
    console.error('❌ 找不到 Model 选择器元素');
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.type) {
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
        message.messages.forEach(msg => addMessage(msg));
        break;
      case 'clear':
        clearMessages();
        break;
      case 'model':
        currentModelEl.textContent = message.modelName;
        break;
      case 'modelLoaded':
        // 显示当前加载的模型信息
        if (message.model) {
          // 使用 ModelConfig 标准字段名
          const modelName = message.model.modelId || message.model.id;
          const provider = message.model.protocolType || '';
          const agentMode = message.model.agentMode;
          const agentName = message.model.agentName || '默认助手';
          
          currentModelEl.textContent = `${modelName}${provider ? ` (${provider})` : ''}`;
          currentModelEl.style.color = 'var(--vscode-foreground)';
          
          // 更新模式选择器状态
          if (modeSelect) {
            modeSelect.value = agentMode ? 'agent' : 'direct';
            currentAgentMode = agentMode;
            
            // 显示/隐藏 Agent 选择器
            if (agentMode) {
              agentSelectorGroup.classList.add('visible');
            } else {
              agentSelectorGroup.classList.remove('visible');
            }
          }
          
          // 更新 Agent 选择器
          if (agentSelect && message.model.agentId) {
            agentSelect.value = message.model.agentId;
          }
          
          console.log('✅ 模型已加载:', {
            model: modelName,
            provider,
            agentMode,
            agentName
          });
        }
        break;
      case 'agentSwitched':
        // Agent 切换成功
        if (message.success && message.agentName) {
          console.log('✅ Agent 已切换:', message.agentName);
          // 可以添加提示信息
        }
        break;
      case 'configLoaded':
        // 加载配置信息
        if (message.config) {
          const config = message.config;
          
          // 更新模式选择器
          if (modeSelect) {
            modeSelect.value = config.agentModeEnabled ? 'agent' : 'direct';
            currentAgentMode = config.agentModeEnabled;
            
            if (config.agentModeEnabled) {
              agentSelectorGroup.classList.add('visible');
            } else {
              agentSelectorGroup.classList.remove('visible');
            }
          }
          
          // 更新 Agent 选择器
          if (agentSelect) {
            agentSelect.value = config.currentAgent || 'default';
          }
          
          // 更新 Model 选择器
          if (modelSelect && config.defaultModel) {
            modelSelect.innerHTML = `<option value="${config.defaultModel}">${config.defaultModel}</option>`;
          }
        }
        break;
      case 'agentList':
        // 填充 Agent 列表
        if (message.agents && Array.isArray(message.agents)) {
          if (agentSelect) {
            agentSelect.innerHTML = message.agents.map(agent => 
              `<option value="${agent.id}">${agent.name}</option>`
            ).join('');
          }
        }
        break;
      case 'modelList':
        // 填充 Model 列表
        if (message.models && Array.isArray(message.models)) {
          if (modelSelect) {
            modelSelect.innerHTML = message.models.map(model => 
              `<option value="${model.name}">${model.name}${model.modelName ? ` (${model.modelName})` : ''}</option>`
            ).join('');
          }
        }
        break;
    }
  });

  // 请求配置信息
  vscode.postMessage({ type: 'ready' });
});
