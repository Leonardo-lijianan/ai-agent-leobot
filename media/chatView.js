// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔵 DOM 加载完成');
  
  const vscode = acquireVsCodeApi();
  const chatContainer = document.getElementById('chatContainer');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const currentModelEl = document.getElementById('currentModel');
  const testMarkdownBtn = document.getElementById('testMarkdownBtn');

  console.log('🔵 按钮元素:', testMarkdownBtn);

  let isLoading = false;

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

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + message.role;
    
    const roleText = message.role === 'user' ? '👤 你' : 
                     message.role === 'assistant' ? '🤖 AI' : '⚠️ 错误';
    
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
    
    messageDiv.innerHTML = `
      <div class="message-role">${roleText}</div>
      <div class="message-content">${contentHtml}</div>
    `;
    
    chatContainer.appendChild(messageDiv);
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
    }
  });

  vscode.postMessage({ type: 'ready' });
});
