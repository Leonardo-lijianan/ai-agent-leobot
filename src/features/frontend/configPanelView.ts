declare function acquireVsCodeApi(): any;

(function() {
  console.log('[ConfigPanel] 脚本开始执行');
  const vscode = acquireVsCodeApi();
  console.log('[ConfigPanel] vscode API 已获取');
  
  // 获取 DOM 元素
  const agentSelect = document.getElementById('agent') as HTMLSelectElement;
  const editModelBtn = document.getElementById('editModelBtn') as HTMLButtonElement;
  const addAgentBtn = document.getElementById('addAgentBtn') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const configTitle = document.getElementById('configTitle') as HTMLHeadingElement;
  
  const editModelModal = document.getElementById('editModelModal') as HTMLDivElement;
  const editStatus = document.getElementById('editStatus') as HTMLDivElement;
  const editProvider = document.getElementById('editProvider') as HTMLSelectElement;
  const editEndpoint = document.getElementById('editEndpoint') as HTMLInputElement;
  const editEndpointBadge = document.getElementById('editEndpointBadge') as HTMLSpanElement;
  const editEndpointHint = document.getElementById('editEndpointHint') as HTMLDivElement;
  const editConfigName = document.getElementById('editConfigName') as HTMLInputElement;
  const editApiKey = document.getElementById('editApiKey') as HTMLInputElement;
  const editModelName = document.getElementById('editModelName') as HTMLInputElement;
  const testEditModelBtn = document.getElementById('testEditModelBtn') as HTMLButtonElement;
  const saveEditModelBtn = document.getElementById('saveEditModelBtn') as HTMLButtonElement;
  const listEditModelsBtn = document.getElementById('listEditModelsBtn') as HTMLButtonElement;
  const closeEditModelBtn = document.getElementById('closeEditModelBtn') as HTMLButtonElement;
  
  const addAgentModal = document.getElementById('addAgentModal') as HTMLDivElement;
  const newAgentId = document.getElementById('newAgentId') as HTMLInputElement;
  const newAgentName = document.getElementById('newAgentName') as HTMLInputElement;
  const newAgentDesc = document.getElementById('newAgentDesc') as HTMLInputElement;
  const newAgentPrompt = document.getElementById('newAgentPrompt') as HTMLTextAreaElement;
  const addAgentStatus = document.getElementById('addAgentStatus') as HTMLDivElement;
  const confirmAddAgent = document.getElementById('confirmAddAgent') as HTMLButtonElement;
  const cancelAddAgent = document.getElementById('cancelAddAgent') as HTMLButtonElement;
  
  // 迁移配置相关元素
  const migrateConfigBtn = document.getElementById('migrateConfigBtn') as HTMLButtonElement;
  const migrateConfigModal = document.getElementById('migrateConfigModal') as HTMLDivElement;
  const currentConfigPath = document.getElementById('currentConfigPath') as HTMLElement;
  const newConfigPath = document.getElementById('newConfigPath') as HTMLInputElement;
  const browsePathBtn = document.getElementById('browsePathBtn') as HTMLButtonElement;
  const confirmMigrateBtn = document.getElementById('confirmMigrateBtn') as HTMLButtonElement;
  const cancelMigrateBtn = document.getElementById('cancelMigrateBtn') as HTMLButtonElement;
  const migrateStatus = document.getElementById('migrateStatus') as HTMLDivElement;
  
  // 检查元素是否存在
  if (!editModelBtn || !editModelModal) {
    console.error('[ConfigPanel] 关键元素不存在！');
    return;
  }
  
  let currentEditingAgentId: string | null = null;
  
  function updateEndpointField(provider: string) {
    const endpoints: Record<string, string> = {
      siliconflow: 'https://api.siliconflow.cn/v1',
      openai: 'https://api.openai.com/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta',
      custom: ''
    };
    
    if (provider === 'custom') {
      editEndpoint.disabled = false;
      editEndpointBadge.style.display = 'none';
      editEndpointHint.textContent = '模型提供商的 API 地址';
    } else {
      editEndpoint.disabled = true;
      editEndpoint.value = endpoints[provider] || '';
      editEndpointBadge.style.display = 'inline-block';
      editEndpointHint.textContent = '已根据提供商自动配置';
    }
  }
  
  editProvider.addEventListener('change', (e) => {
    updateEndpointField((e.target as HTMLSelectElement).value);
  });
  
  editModelBtn.addEventListener('click', () => {
    currentEditingAgentId = agentSelect.value;
    console.log('[ConfigPanel] 点击编辑模型按钮，当前 Agent:', currentEditingAgentId);
    
    vscode.postMessage({
      type: 'editModel',
      agentId: currentEditingAgentId
    });
    
    editModelModal.style.display = 'block';
  });
  
  closeEditModelBtn.addEventListener('click', () => {
    editModelModal.style.display = 'none';
    editStatus.style.display = 'none';
  });
  
  testEditModelBtn.addEventListener('click', () => {
    const config: any = {
      id: (editConfigName as HTMLInputElement).value,
      protocolType: (editProvider as HTMLSelectElement).value,
      endpoint: (editEndpoint as HTMLInputElement).value,
      apiKey: (editApiKey as HTMLInputElement).value,
      modelId: (editModelName as HTMLInputElement).value
    };
    
    console.log('[ConfigPanel] 测试连接配置:', config);
    
    vscode.postMessage({
      type: 'testModelConfig',
      config: config,
      agentId: currentEditingAgentId
    });
  });
  
  saveEditModelBtn.addEventListener('click', () => {
    const config: any = {
      id: (editConfigName as HTMLInputElement).value,
      protocolType: (editProvider as HTMLSelectElement).value,
      endpoint: (editEndpoint as HTMLInputElement).value,
      apiKey: (editApiKey as HTMLInputElement).value,
      modelId: (editModelName as HTMLInputElement).value
    };
    
    console.log('[ConfigPanel] 保存配置:', config);
    
    vscode.postMessage({
      type: 'saveModelConfig',
      config: config,
      agentId: currentEditingAgentId
    });
  });
  
  listEditModelsBtn.addEventListener('click', () => {
    vscode.postMessage({
      type: 'listModels',
      provider: (editProvider as HTMLSelectElement).value,
      endpoint: (editEndpoint as HTMLInputElement).value,
      apiKey: (editApiKey as HTMLInputElement).value
    });
  });
  
  addAgentBtn.addEventListener('click', () => {
    addAgentModal.style.display = 'block';
    addAgentStatus.style.display = 'none';
  });
  
  cancelAddAgent.addEventListener('click', () => {
    addAgentModal.style.display = 'none';
    addAgentStatus.style.display = 'none';
  });
  
  confirmAddAgent.addEventListener('click', () => {
    const agentId = (newAgentId as HTMLInputElement).value.trim();
    const agentName = (newAgentName as HTMLInputElement).value.trim();
    const agentDesc = (newAgentDesc as HTMLInputElement).value.trim();
    const agentPrompt = (newAgentPrompt as HTMLTextAreaElement).value.trim();
    
    const tools: string[] = [];
    document.querySelectorAll('.agent-tool:checked').forEach((el) => {
      tools.push((el as HTMLInputElement).value);
    });
    
    console.log('[ConfigPanel] 新增 Agent:', { agentId, agentName, agentDesc, agentPrompt, tools });
    
    vscode.postMessage({
      type: 'addAgent',
      agent: {
        id: agentId,
        name: agentName,
        description: agentDesc,
        systemPrompt: agentPrompt,
        tools: tools
      }
    });
  });

  // 迁移配置按钮事件
  migrateConfigBtn.addEventListener('click', () => {
    console.log('[ConfigPanel] 点击迁移配置按钮');
    
    // 显示当前配置路径
    vscode.postMessage({
      type: 'getConfigPath'
    });
    
    migrateConfigModal.style.display = 'block';
    migrateStatus.style.display = 'none';
    newConfigPath.value = '';
    confirmMigrateBtn.disabled = true;
  });

  // 浏览路径按钮
  browsePathBtn.addEventListener('click', () => {
    console.log('[ConfigPanel] 点击浏览路径按钮');
    
    vscode.postMessage({
      type: 'browseConfigPath'
    });
  });

  // 确认迁移按钮
  confirmMigrateBtn.addEventListener('click', () => {
    const newPath = newConfigPath.value.trim();
    if (!newPath) {
      showStatus('请先选择新的配置路径', 'error');
      return;
    }
    
    console.log('[ConfigPanel] 开始迁移配置到:', newPath);
    
    vscode.postMessage({
      type: 'migrateConfig',
      newPath: newPath
    });
  });

  // 取消迁移按钮
  cancelMigrateBtn.addEventListener('click', () => {
    migrateConfigModal.style.display = 'none';
    migrateStatus.style.display = 'none';
  });
  
  window.addEventListener('message', (event) => {
    const message = event.data;
    
    console.log('[ConfigPanel] 收到消息:', message.type);
    
    if (message.type === 'loadConfig') {
      console.log('[ConfigPanel] 加载配置，填充表单数据');
      if (message.config) {
        (editConfigName as HTMLInputElement).value = message.config.id || '';
        (editProvider as HTMLSelectElement).value = message.config.protocolType || 'siliconflow';
        (editEndpoint as HTMLInputElement).value = message.config.endpoint || '';
        (editApiKey as HTMLInputElement).value = message.config.apiKey || '';
        (editModelName as HTMLInputElement).value = message.config.modelId || '';
        
        updateEndpointField((editProvider as HTMLSelectElement).value);
      }
    }
    
    if (message.type === 'testResult') {
      editStatus.textContent = message.success ? '✅ 测试成功！' : '❌ 测试失败：' + message.error;
      editStatus.className = 'status ' + (message.success ? 'success' : 'error');
      editStatus.style.display = 'block';
    }
    
    if (message.type === 'editModelResult') {
      editStatus.textContent = message.success ? '✅ 保存成功！' : '❌ 保存失败：' + message.error;
      editStatus.className = 'status ' + (message.success ? 'success' : 'error');
      editStatus.style.display = 'block';
      
      if (message.success) {
        setTimeout(() => {
          editModelModal.style.display = 'none';
          editStatus.style.display = 'none';
        }, 1000);
      }
    }
    
    if (message.type === 'listModelsResult') {
      if (message.success && message.models && message.models.length > 0) {
        const modelList = message.models.map((m: any) => m.id).join('\n');
        editStatus.textContent = `可用模型:\n${modelList}`;
        editStatus.className = 'status success';
        editStatus.style.display = 'block';
      } else {
        editStatus.textContent = '❌ 获取模型列表失败：' + (message.error || '未知错误');
        editStatus.className = 'status error';
        editStatus.style.display = 'block';
      }
    }
    
    if (message.type === 'addAgentResult') {
      addAgentStatus.textContent = message.success ? '✅ Agent 添加成功！' : '❌ 添加失败：' + message.error;
      addAgentStatus.className = 'status ' + (message.success ? 'success' : 'error');
      addAgentStatus.style.display = 'block';
      
      if (message.success) {
        setTimeout(() => {
          addAgentModal.style.display = 'none';
          addAgentStatus.style.display = 'none';
          (newAgentId as HTMLInputElement).value = '';
          (newAgentName as HTMLInputElement).value = '';
          (newAgentDesc as HTMLInputElement).value = '';
          (newAgentPrompt as HTMLTextAreaElement).value = '';
        }, 1000);
      }
    }
    
    if (message.type === 'agentModelList') {
      console.log('[ConfigPanel] 更新 Agent 列表');
      if (message.agentModels) {
        agentSelect.innerHTML = '';
        message.agentModels.forEach((agent: any) => {
          const option = document.createElement('option');
          option.value = agent.id;
          option.textContent = agent.name || agent.id;
          agentSelect.appendChild(option);
        });
        
        if (message.agentModels.length > 0) {
          configTitle.textContent = `⚙️ AI Agent LeoBot 配置 - ${message.agentModels[0].name || message.agentModels[0].id}`;
        }
      }
    }
    
    // 迁移配置相关消息处理
    if (message.type === 'configPathInfo') {
      currentConfigPath.textContent = message.currentPath || '获取失败';
      if (message.error) {
        migrateStatus.textContent = '❌ 获取配置路径失败：' + message.error;
        migrateStatus.className = 'status error';
        migrateStatus.style.display = 'block';
      }
    }
    
    if (message.type === 'browsePathResult') {
      if (message.success) {
        newConfigPath.value = message.newPath;
        confirmMigrateBtn.disabled = false;
        migrateStatus.textContent = '✅ 路径选择成功';
        migrateStatus.className = 'status success';
        migrateStatus.style.display = 'block';
      } else {
        migrateStatus.textContent = '❌ 路径选择失败：' + (message.error || '未知错误');
        migrateStatus.className = 'status error';
        migrateStatus.style.display = 'block';
      }
    }
    
    if (message.type === 'migrateResult') {
      if (message.success) {
        migrateStatus.textContent = '✅ ' + (message.message || '迁移成功！');
        migrateStatus.className = 'status success';
        migrateStatus.style.display = 'block';
        
        // 3秒后关闭模态框
        setTimeout(() => {
          migrateConfigModal.style.display = 'none';
          migrateStatus.style.display = 'none';
        }, 3000);
      } else {
        migrateStatus.textContent = '❌ 迁移失败：' + (message.error || '未知错误');
        migrateStatus.className = 'status error';
        migrateStatus.style.display = 'block';
      }
    }
  });
  
  function showStatus(message: string, type: string) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.whiteSpace = 'pre-wrap';
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
  
  console.log('[ConfigPanel] 脚本执行完成');
})();
