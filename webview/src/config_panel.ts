import { AgentConfigData, ModelConfigData } from "./types/messageHub_P.js";
import { messageHub } from "./utils/messageHub.js";

(async function () /*这个也是不知道加了 async 有什么副作用*/ {
  console.log("[ConfigPanel] 脚本开始执行");
  // #region DOM 元素引用
  // 已废弃agentSelect，因为在 chat_view 有，就不用重复了
  // 已废弃statusDiv，由各自模态框来显示
  // 已废弃，直接显示"⚙️ AI Agent LeoBot 配置"即可

  // 主界面
  const addModelBtn = document.getElementById("addModelBtn") as HTMLButtonElement;
  const addAgentBtn = document.getElementById("addAgentBtn") as HTMLButtonElement;
  const migrateConfigBtn = document.getElementById("migrateConfigBtn") as HTMLButtonElement;

  // 模型配置模态框
  const configModelModal = document.getElementById("configModelModal") as HTMLDivElement;
  const modelModalTitle = document.getElementById("model-modal-title") as HTMLHeadingElement;
  // 1. 表单字段
  const configName = document.getElementById("configName") as HTMLInputElement;
  const configProvider = document.getElementById("configProvider") as HTMLSelectElement;
  const configEndpoint = document.getElementById("configEndpoint") as HTMLInputElement;
  const configApiKey = document.getElementById("configApiKey") as HTMLInputElement;
  const configModelId = document.getElementById("configModelId") as HTMLInputElement;
  // ?. extra
  const configEndpointBadge = document.getElementById("configEndpointBadge") as HTMLSpanElement;
  const configEndpointHint = document.getElementById("configEndpointHint") as HTMLDivElement;
  // 2. 按钮
  const testConnectBtn = document.getElementById("testConnectBtn") as HTMLButtonElement;
  const saveModelConfigBtn = document.getElementById("saveModelConfigBtn") as HTMLButtonElement;
  const listModelsBtn = document.getElementById("listModelsBtn") as HTMLButtonElement;
  const closeModelModalBtn = document.getElementById("closeModelModalBtn") as HTMLButtonElement;
  // 3. 状态
  const configModelStatus = document.getElementById("configModelStatus") as HTMLDivElement;

  // Agent 配置模态框
  const addAgentModal = document.getElementById("addAgentModal") as HTMLDivElement;
  const agentModalTitle = document.getElementById("agentModalTitle") as HTMLElement;
  // 1. 表单字段
  const newAgentName = document.getElementById("newAgentName") as HTMLInputElement;
  const newAgentId = document.getElementById("newAgentId") as HTMLInputElement;
  const newAgentDesc = document.getElementById("newAgentDesc") as HTMLInputElement;
  const newAgentPrompt = document.getElementById("newAgentPrompt") as HTMLTextAreaElement;
  // 2. 按钮
  const confirmAddAgent = document.getElementById("confirmAddAgent") as HTMLButtonElement;
  const cancelAddAgent = document.getElementById("cancelAddAgent") as HTMLButtonElement;
  // 3. 状态
  const addAgentStatus = document.getElementById("addAgentStatus") as HTMLDivElement;

  // 迁移配置相关元素
  const migrateConfigModal = document.getElementById("migrateConfigModal") as HTMLDivElement;
  // 1. 字段
  const currentConfigPath = document.getElementById("currentConfigPath") as HTMLElement;
  const newConfigPath = document.getElementById("newConfigPath") as HTMLInputElement;
  // 2. 按钮
  const browsePathBtn = document.getElementById("browsePathBtn") as HTMLButtonElement;
  const confirmMigrateBtn = document.getElementById("confirmMigrateBtn") as HTMLButtonElement;
  const cancelMigrateBtn = document.getElementById("cancelMigrateBtn") as HTMLButtonElement;
  // 3. 状态
  const migrateStatus = document.getElementById("migrateStatus") as HTMLDivElement;

  // 列表显示元素
  const modelConfigList = document.getElementById("modelConfigList") as HTMLDivElement;
  const agentList = document.getElementById("agentList") as HTMLDivElement;
  const modelListContainer = document.getElementById("modelListContainer") as HTMLDivElement;
  const agentListContainer = document.getElementById("agentListContainer") as HTMLDivElement;
  const modelListTab = document.getElementById("modelListTab") as HTMLButtonElement;
  const agentListTab = document.getElementById("agentListTab") as HTMLButtonElement;
  // #endregion

  // #region 初始化操作
  // 检查元素是否存在
  if (!addModelBtn || !configModelModal) {
    console.error("[ConfigPanel] 关键元素不存在！");
    return;
  }

  // 加载模型配置列表和 Agent 列表
  loadModelConfigList();
  loadAgentList();

  // 标签页切换功能
  modelListTab.addEventListener("click", () => {
    modelListContainer.classList.add("active");
    modelListContainer.classList.remove("hidden");
    agentListContainer.classList.add("hidden");
    agentListContainer.classList.remove("active");
    modelListTab.classList.add("primary");
    modelListTab.classList.remove("secondary");
    agentListTab.classList.add("secondary");
    agentListTab.classList.remove("primary");
  });

  agentListTab.addEventListener("click", () => {
    modelListContainer.classList.add("hidden");
    modelListContainer.classList.remove("active");
    agentListContainer.classList.add("active");
    agentListContainer.classList.remove("hidden");
    modelListTab.classList.add("secondary");
    modelListTab.classList.remove("primary");
    agentListTab.classList.add("primary");
    agentListTab.classList.remove("secondary");
  });

  async function loadModelConfigList() {
    console.log("[ConfigPanel] 加载模型配置列表");
    const response = await messageHub.request("config:listConfigs", { configType: "model" });
    if (response.success && response.data && response.data.configs.length > 0) {
      renderModelConfigList(response.data.configs as ModelConfigData[]);
    } else {
      modelConfigList.innerHTML = `
        <div style="color: var(--vscode-descriptionForeground); text-align: center; padding: 20px">
          暂无模型配置
        </div>
      `;
    }
  } // 2026/04/18 改 过
  async function loadAgentList() {
    console.log("[ConfigPanel] 加载 Agent 列表");
    const response = await messageHub.request("config:listConfigs", { configType: "agent" });
    if (response.success && response.data && response.data.configs.length > 0) {
      renderAgentList(response.data.configs as AgentConfigData[]);
    } else {
      agentList.innerHTML = `
        <div style="color: var(--vscode-descriptionForeground); text-align: center; padding: 20px">
          暂无 Agent
        </div>
      `;
    }
  } // 2026/04/18 改 过
  function renderModelConfigList(configs: ModelConfigData[]) {
    modelConfigList.innerHTML = "";
    configs.forEach((config) => {
      const configDiv = document.createElement("div");
      configDiv.className = "config-card";

      // 截断长文本的辅助函数
      const truncateText = (text: string, maxLength: number = 30) => {
        if (!text) {
          return "-";
        }
        return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
      };

      configDiv.innerHTML = `
        <div class="config-card-header">
          <strong class="config-card-title">${truncateText(config.id, 25)}</strong>
          <div class="config-card-actions">
            <button class="config-card-btn edit-model-config" data-id="${config.id}" title="编辑此配置">✏️ 编辑</button>
            <button class="config-card-btn delete-model-config" data-id="${config.id}" title="删除此配置">❌ 删除</button>
          </div>
        </div>
        <div class="config-card-body">
          <div class="config-card-item"><span class="config-card-label">提供商:</span> ${config.endpoint || "自定义"}</div>
          <div class="config-card-item"><span class="config-card-label">端点:</span> <span class="config-card-text" title="${config.endpoint || "-"}">${truncateText(config.endpoint || "-", 35)}</span></div>
          <div class="config-card-item"><span class="config-card-label">模型:</span> <span class="config-card-text" title="${config.modelId || "-"}">${truncateText(config.modelId || "-", 35)}</span></div>
        </div>
      `;
      modelConfigList.appendChild(configDiv);
    });
  } // 2026/04/18 改

  // 事件委托：监听模型列表的点击事件（只绑定一次）
  modelConfigList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;

    // 点击了编辑按钮
    if (target.classList.contains("edit-model-config")) {
      const id = target.dataset.id;
      console.log("[ConfigPanel] 编辑模型配置:", id);
      const response = await messageHub.request("config:loadConfig", {
        configType: "model",
        id: id,
      });
      if (response.success) {
        const modelConfig = response.data.config as ModelConfigData;
        configName.value = modelConfig.id;
        configProvider.value = modelConfig.protocolType;
        configEndpoint.value = modelConfig.endpoint;
        configApiKey.value = modelConfig.apiKey;
        configModelId.value = modelConfig.modelId;
        modelModalTitle.textContent = "✏️ 编辑模型配置";
        configModelModal.style.display = "block";
      }
    }

    // 点击了删除按钮
    if (target.classList.contains("delete-model-config")) {
      const id = target.dataset.id;
      console.log("[ConfigPanel] 删除模型配置:", id);
      const response = await messageHub.request("config:deleteConfig", {
        configType: "model",
        id: id,
      });
      if (response.success) {
        loadModelConfigList();
      }
    }
  });

  function renderAgentList(agents: AgentConfigData[]) {
    agentList.innerHTML = "";
    agents.forEach((agent) => {
      const agentDiv = document.createElement("div");
      agentDiv.className = "config-card";

      // 截断长文本的辅助函数
      const truncateText = (text: string, maxLength: number = 30) => {
        if (!text) {
          return "-";
        }
        return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
      };

      agentDiv.innerHTML = `
        <div class="config-card-header">
          <strong class="config-card-title">${truncateText(agent.name || agent.id, 25)}</strong>
          <div class="config-card-actions">
            <button class="config-card-btn edit-agent" data-id="${agent.id}" title="编辑此 Agent">✏️ 编辑</button>
            <button class="config-card-btn delete-agent" data-id="${agent.id}" title="删除此 Agent">❌ 删除</button>
          </div>
        </div>
        <div class="config-card-body">
          <div class="config-card-item"><span class="config-card-label">描述:</span> <span class="config-card-text" title="${agent.description || "-"}">${truncateText(agent.description || "-", 40)}</span></div>
          <div class="config-card-item"><span class="config-card-label">工具:</span> ${(agent.tools || []).join(", ") || "无"}</div>
        </div>
      `;
      agentList.appendChild(agentDiv);
    }); // 2026/04/18 改
  }

  // 事件委托：监听 Agent 列表的点击事件（只绑定一次）
  agentList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;

    // 点击了编辑按钮
    if (target.classList.contains("edit-agent")) {
      const id = target.dataset.id;
      console.log("[ConfigPanel] 编辑 Agent:", id);
      const response = await messageHub.request("config:loadConfig", {
        configType: "agent",
        id: id,
      });
      if (response.success) {
        const agentConfig = response.data.config as AgentConfigData;
        newAgentId.value = agentConfig.id;
        newAgentName.value = agentConfig.name;
        newAgentDesc.value = agentConfig.description || "";
        newAgentPrompt.value = agentConfig.systemPrompt || "";

        // 恢复工具选择状态
        document.querySelectorAll(".agent-tool").forEach((el) => {
          const checkbox = el as HTMLInputElement;
          checkbox.checked = agentConfig.tools?.includes(checkbox.value) || false;
        });

        // 修改模态框标题
        if (agentModalTitle) {
          agentModalTitle.textContent = "✏️ 编辑 Agent";
        }

        addAgentModal.style.display = "block";
      }
    }

    // 点击了删除按钮
    if (target.classList.contains("delete-agent")) {
      const id = target.dataset.id;
      console.log("[ConfigPanel] 删除 Agent:", id);
      const response = await messageHub.request("config:deleteConfig", {
        configType: "agent",
        id: id,
      });
      if (response.success) {
        loadAgentList();
        // 同时刷新下拉框
        messageHub.request("config:listConfigs", { configType: "agent" }).then((res) => {
          if (res.success && res.data) {
            const agentSelect = document.getElementById("agent") as HTMLSelectElement;
            agentSelect.innerHTML = "";
            const configs = res.data.configs as AgentConfigData[];
            configs.forEach((a: AgentConfigData) => {
              const option = document.createElement("option");
              option.value = a.id;
              option.textContent = a.name || a.id;
              agentSelect.appendChild(option);
            });
          }
        });
      }
    }
  });

  function updateEndpointField(provider: string) {
    const endpoints: Record<string, string> = {
      siliconflow: "https://api.siliconflow.cn/v1",
      openai: "https://api.openai.com/v1",
      gemini: "https://generativelanguage.googleapis.com/v1beta",
      custom: "",
    };

    if (provider === "custom") {
      configEndpoint.disabled = false;
      configEndpointBadge.style.display = "none";
      configEndpointHint.textContent = "模型提供商的 API 地址";
    } else {
      configEndpoint.disabled = true;
      configEndpoint.value = endpoints[provider] || "";
      configEndpointBadge.style.display = "inline-block";
      configEndpointHint.textContent = "已根据提供商自动配置";
    }
  }

  configProvider.addEventListener("change", (e) => {
    updateEndpointField((e.target as HTMLSelectElement).value);
  });

  // #endregion

  // 添加模型配置按钮
  addModelBtn.addEventListener("click", () => {
    configName.value = "";
    configProvider.value = "siliconflow";
    configEndpoint.value = "";
    configApiKey.value = "";
    configModelId.value = "";
    configModelStatus.textContent = "";

    updateEndpointField("siliconflow");
    modelModalTitle.textContent = "➕ 新增模型配置";
    configModelModal.style.display = "block";
  }); // 2026/04/18 改 2026/04/18 过
  addAgentBtn.addEventListener("click", () => {
    (newAgentId as HTMLInputElement).value = "";
    (newAgentName as HTMLInputElement).value = "";
    (newAgentDesc as HTMLInputElement).value = "";
    (newAgentPrompt as HTMLTextAreaElement).value = "";

    // 恢复模态框标题为新增模式
    if (agentModalTitle) {
      agentModalTitle.textContent = "➕ 新增 Agent";
    }

    addAgentModal.style.display = "block";
  }); // 2026/04/17 改 2026/04/18 过
  migrateConfigBtn.addEventListener("click", async () => {
    console.log("[ConfigPanel] 点击迁移配置按钮");
    const response = await messageHub.request("config:getConfigPath", {});
    if (response.success && response.data) {
      currentConfigPath.textContent = response.data.path;
    } else {
      showStatus(migrateStatus, "❌ 加载失败：" + response.error, "error");
    }
    migrateStatus.style.display = "none";
    newConfigPath.value = "";
    confirmMigrateBtn.disabled = true;

    migrateConfigModal.style.display = "block";
  }); // 2026/04/17 改 2026/04/18 完成response处理 过

  // 模型配置按钮
  listModelsBtn.addEventListener("click", async () => {
    const provider = configProvider.value;
    const endpoint = configEndpoint.value;
    const apiKey = configApiKey.value;

    // 检查必填字段
    if (!apiKey) {
      showStatus(configModelStatus, "❌ 请先填写 API Key", "error");
      return;
    }

    const response = await messageHub.request("config:listUsableModels", {
      provider,
      endpoint,
      apiKey,
    }); // 2026/04/17 改

    const modelListDiv = document.getElementById("availableModelList") as HTMLDivElement;

    if (
      response.success &&
      response.data &&
      response.data.usableModels &&
      response.data.usableModels.length > 0
    ) {
      const models = response.data.usableModels;

      // 显示模型列表
      modelListDiv.style.display = "block";
      modelListDiv.innerHTML = models
        .map((model: string) => {
          const modelName = model.split("/").pop() || model; // 提取模型名称
          return `
          <div class="model-item" data-model="${model}">
            <div class="model-item-name">${modelName}</div>
            <div class="model-item-id">${model}</div>
          </div>
        `;
        })
        .join("");

      // 绑定点击事件
      modelListDiv.querySelectorAll(".model-item").forEach((item) => {
        item.addEventListener("click", () => {
          const model = (item as HTMLDivElement).dataset.model;
          if (model) {
            configModelId.value = model;
            modelListDiv.style.display = "none";
            showStatus(configModelStatus, `✅ 已选择：${model}`, "success");
          }
        });
      });

      showStatus(configModelStatus, `✅ 获取成功，共 ${models.length} 个模型，点击选择`, "success");
    } else {
      modelListDiv.style.display = "none";
      showStatus(configModelStatus, "❌ 获取失败：" + response.error, "error");
    }
  }); // 2026/04/17 改 2026/04/18 过
  testConnectBtn.addEventListener("click", async () => {
    const config: ModelConfigData = {
      id: (configName as HTMLInputElement).value,
      protocolType: (configProvider as HTMLSelectElement).value as protocolEnum,
      endpoint: (configEndpoint as HTMLInputElement).value,
      apiKey: (configApiKey as HTMLInputElement).value,
      modelId: (configModelId as HTMLInputElement).value,
    };

    console.log("[ConfigPanel] 测试连接配置:", config);

    const response = await messageHub.request("config:testModelConfig", {
      config: config,
    });

    if (response.success) {
      showStatus(configModelStatus, "✅ 测试成功！", "success");
    } else {
      showStatus(configModelStatus, "❌ 测试失败：" + response.error, "error");
    }
  }); // 2026/04/17 改 2026/04/18 完成response处理 过
  saveModelConfigBtn.addEventListener("click", async () => {
    // 验证必填字段
    const configIdValue = (configName as HTMLInputElement).value.trim();
    const configEndpointValue = (configEndpoint as HTMLInputElement).value.trim();
    const configApiKeyValue = (configApiKey as HTMLInputElement).value.trim();
    const configModelIdValue = (configModelId as HTMLInputElement).value.trim();

    if (!configIdValue) {
      showStatus(configModelStatus, "❌ 模型配置名不能为空", "error");
      return;
    }

    if (!configEndpointValue) {
      showStatus(configModelStatus, "❌ API 端点不能为空", "error");
      return;
    }

    if (!configApiKeyValue) {
      showStatus(configModelStatus, "❌ API Key 不能为空", "error");
      return;
    }

    if (!configModelIdValue) {
      showStatus(configModelStatus, "❌ 模型 ID 不能为空", "error");
      return;
    }

    const config: ModelConfigData = {
      id: configIdValue,
      protocolType: (configProvider as HTMLSelectElement).value as protocolEnum,
      endpoint: configEndpointValue,
      apiKey: configApiKeyValue,
      modelId: configModelIdValue,
    };

    // 判断是新增还是修改（通过模态框标题判断）
    const modelModalTitle = document.getElementById("model-modal-title") as HTMLElement;
    const modalTitleText = modelModalTitle?.textContent?.trim() || "";
    const isEdit = modalTitleText.includes("编辑");

    console.log("[ConfigPanel]", isEdit ? "修改模型配置" : "新增模型配置", {
      config,
      modalTitle: modalTitleText,
    });

    // 明确告知后端是新增还是修改
    const requestType = isEdit ? "config:changeConfig" : "config:addConfig";
    const response = await messageHub.request(requestType, {
      configType: "model",
      config: config,
    });

    if (response.success) {
      // 刷新模型列表
      await loadModelConfigList();
      const statusMsg = isEdit ? "✅ 保存成功！" : "✅ 添加成功！";

      // 新增模式：清空表单，标题保持"新增"
      // 编辑模式：不清空，标题保持"编辑"
      if (!isEdit) {
        configName.value = "";
        configProvider.value = "openai";
        configEndpoint.value = "";
        configApiKey.value = "";
        configModelId.value = "";
      }

      // 恢复按钮状态
      saveModelConfigBtn.disabled = false;

      // 最后显示状态（会自动关闭模态框）
      showStatus(configModelStatus, statusMsg, "success", configModelModal);
    } else {
      showStatus(
        configModelStatus,
        `❌ ${isEdit ? "保存" : "添加"}失败：${response.error || "未知错误"}`,
        "error"
      );
      // 恢复按钮状态
      saveModelConfigBtn.disabled = false;
    }
  });
  closeModelModalBtn.addEventListener("click", () => {
    configModelModal.style.display = "none";
    configModelStatus.style.display = "none";
  }); // 2026/04/17 过

  // Agent 配置按钮
  confirmAddAgent.addEventListener("click", async () => {
    const agentIdInput = newAgentId as HTMLInputElement;
    const agentNameInput = newAgentName as HTMLInputElement;
    const agentDescInput = newAgentDesc as HTMLInputElement;
    const agentPromptInput = newAgentPrompt as HTMLTextAreaElement;

    const agentId = agentIdInput.value.trim();
    const agentName = agentNameInput.value.trim();
    const agentDesc = agentDescInput.value.trim();
    const agentPrompt = agentPromptInput.value.trim();

    // 1. 验证消息内容的完整性和格式正确性
    if (!agentId) {
      addAgentStatus.textContent = "❌ Agent ID 不能为空";
      addAgentStatus.className = "status error";
      addAgentStatus.style.display = "block";
      return;
    }

    if (!agentName) {
      addAgentStatus.textContent = "❌ Agent 名称不能为空";
      addAgentStatus.className = "status error";
      addAgentStatus.style.display = "block";
      return;
    }

    if (!agentPrompt) {
      addAgentStatus.textContent = "❌ Agent 系统提示词不能为空";
      addAgentStatus.className = "status error";
      addAgentStatus.style.display = "block";
      return;
    }

    // 4. 添加加载状态指示，防止重复提交
    confirmAddAgent.disabled = true;
    confirmAddAgent.textContent = "提交中...";
    addAgentStatus.style.display = "block";
    addAgentStatus.textContent = "⏳ 正在提交，请稍候...";
    addAgentStatus.className = "status loading";

    const tools: string[] = [];
    document.querySelectorAll(".agent-tool:checked").forEach((el) => {
      tools.push((el as HTMLInputElement).value);
    });

    // 判断是新增还是编辑（通过模态框标题判断）
    const modalTitleText = agentModalTitle?.textContent?.trim() || "";
    const isEdit = modalTitleText.includes("编辑");

    console.log("[ConfigPanel]", isEdit ? "编辑 Agent" : "新增 Agent", {
      agentId,
      agentName,
      agentDesc,
      agentPrompt,
      tools,
    });

    // 明确告知后端是新增还是编辑
    const requestType = isEdit ? "config:changeConfig" : "config:addConfig";
    const response = await messageHub.request(requestType, {
      configType: "agent",
      config: {
        id: agentId,
        name: agentName,
        description: agentDesc,
        systemPrompt: agentPrompt,
        tools: tools,
        modelConfigId: "default",
      },
    });

    if (response.success) {
      loadAgentList();
      const statusMsg = isEdit ? "✅ 保存成功！" : "✅ 添加成功！";

      if (!isEdit) {
        newAgentId.value = "";
        newAgentName.value = "";
        newAgentDesc.value = "";
        newAgentPrompt.value = "";
      }

      // 恢复按钮状态
      confirmAddAgent.disabled = false;
      confirmAddAgent.textContent = "确定";

      // 最后显示状态（会自动关闭模态框）
      showStatus(addAgentStatus, statusMsg, "success", addAgentModal);
    } else {
      showStatus(
        addAgentStatus,
        `❌ ${isEdit ? "保存" : "添加"}失败：${response.error || "未知错误"}`,
        "error"
      );
      // 恢复按钮状态
      confirmAddAgent.disabled = false;
      confirmAddAgent.textContent = "确定";
    }
  }); // 2026/04/18 过
  cancelAddAgent.addEventListener("click", () => {
    addAgentModal.style.display = "none";
    addAgentStatus.style.display = "none";
  }); // 2026/04/17 过

  // 迁移配置文件模态框按钮
  browsePathBtn.addEventListener("click", async () => {
    console.log("[ConfigPanel] 点击浏览路径按钮");

    const response = await messageHub.request("config:browseConfigPath", {});
    if (response.success) {
      if (response.data.cancelled) {
        showStatus(migrateStatus, "❌ 取消选择路径", "error");
        return;
      }
      newConfigPath.value = response.data.path;
      confirmMigrateBtn.disabled = false;
      showStatus(migrateStatus, "✅ 路径选择成功", "success", migrateConfigModal);
    } else {
      showStatus(migrateStatus, "❌ 选择路径失败：" + (response.error || "未知错误"), "error");
      // migrateStatus.textContent = "❌ 路径选择已取消";
      // migrateStatus.className = "status error";
      // migrateStatus.style.display = "block";
    }
  }); // 2026/04/17 改 2026/04/18 完成response处理 过
  confirmMigrateBtn.addEventListener("click", async () => {
    const newPath = newConfigPath.value.trim();
    if (!newPath) {
      showStatus(migrateStatus, "请先选择新的配置路径", "error");
      return;
    }

    console.log("[ConfigPanel] 开始迁移配置到:", newPath);

    const response = await messageHub.request("config:migrateConfig", { newPath: newPath });
    if (response.success) {
      showStatus(migrateStatus, "✅ 迁移成功！", "success", migrateConfigModal);
    } else {
      showStatus(migrateStatus, "❌ 迁移失败：" + (response.error || "未知错误"), "error");
    }
  }); // 2026/04/17 改 2026/04/18 完成response处理 过
  cancelMigrateBtn.addEventListener("click", () => {
    migrateConfigModal.style.display = "none";
    migrateStatus.style.display = "none";
  }); // 2026/04/17 过

  // # region 暂时关闭的on
  // 监听后端发送的消息
  // messageHub.on("ConfigPanel:loadModelConfig", (config) => {
  //   console.log("[ConfigPanel] 加载配置，填充表单数据");
  //   if (config) {
  //     (configName as HTMLInputElement).value = config.id || "";
  //     (configProvider as HTMLSelectElement).value = config.protocolType || "siliconflow";
  //     (configEndpoint as HTMLInputElement).value = config.endpoint || "";
  //     (configApiKey as HTMLInputElement).value = config.apiKey || "";
  //     (configModelId as HTMLInputElement).value = config.modelId || "";

  //     updateEndpointField((configProvider as HTMLSelectElement).value);
  //   }
  // });

  // messageHub.on("ConfigPanel:configResult", (data) => {
  //   if (data.configType === "add") {
  //     if (data.success) {
  //       addAgentStatus.textContent = "✅ Agent 添加成功！";
  //       addAgentStatus.className = "status success";
  //       addAgentStatus.style.display = "block";

  //       // 刷新 Agent 列表
  //       loadAgentList();

  //       setTimeout(() => {
  //         addAgentModal.style.display = "none";
  //         addAgentStatus.style.display = "none";
  //         (newAgentId as HTMLInputElement).value = "";
  //         (newAgentName as HTMLInputElement).value = "";
  //         (newAgentDesc as HTMLInputElement).value = "";
  //         (newAgentPrompt as HTMLTextAreaElement).value = "";
  //       }, 1000);
  //     } else {
  //       addAgentStatus.textContent = `❌ 添加失败：${data.error || "未知错误"}`;
  //       addAgentStatus.className = "status error";
  //       addAgentStatus.style.display = "block";

  //       // 恢复按钮状态
  //       confirmAddAgent.disabled = false;
  //       confirmAddAgent.textContent = "确定";
  //     }
  //   } else if (data.configType === "change") {
  //     if (data.success) {
  //       configModelStatus.textContent = "✅ 保存成功！";
  //       configModelStatus.className = "status success";
  //       configModelStatus.style.display = "block";

  //       // 刷新模型配置列表
  //       loadModelConfigList();

  //       setTimeout(() => {
  //         configModelModal.style.display = "none";
  //         configModelStatus.style.display = "none";
  //       }, 1000);
  //     } else {
  //       configModelStatus.textContent = `❌ 保存失败：${data.error || "未知错误"}`;
  //       configModelStatus.className = "status error";
  //       configModelStatus.style.display = "block";
  //     }
  //   } else if (data.configType === "delete") {
  //     if (data.success) {
  //       configModelStatus.textContent = "✅ 删除成功！";
  //       configModelStatus.className = "status success";
  //       configModelStatus.style.display = "block";

  //       // 刷新模型配置列表
  //       loadModelConfigList();

  //       setTimeout(() => {
  //         configModelModal.style.display = "none";
  //         configModelStatus.style.display = "none";
  //       }, 1000);
  //     } else {
  //       configModelStatus.textContent = `❌ 删除失败：${data.error || "未知错误"}`;
  //       configModelStatus.className = "status error";
  //       configModelStatus.style.display = "block";
  //     }
  //   }
  // });

  // messageHub.on("ConfigPanel:listModelsResult", (data) => {
  //   if (data.success && data.models && data.models.length > 0) {
  //     const modelList = data.models.join("\n");
  //     configModelStatus.textContent = `可用模型:\n${modelList}`;
  //     configModelStatus.className = "status success";
  //     configModelStatus.style.display = "block";
  //   } else {
  //     configModelStatus.textContent = "❌ 获取模型列表失败：" + (data.error || "未知错误");
  //     configModelStatus.className = "status error";
  //     configModelStatus.style.display = "block";
  //   }
  // });

  // messageHub.on("ConfigPanel:agentModelList", (data) => {
  //   console.log("[ConfigPanel] 更新 Agent 列表");
  //   if (data && data.length > 0) {
  //     agentSelect.innerHTML = "";
  //     data.forEach((agent) => {
  //       const option = document.createElement("option");
  //       option.value = agent.id;
  //       option.textContent = agent.name || agent.id;
  //       agentSelect.appendChild(option);
  //     });

  //     if (data.length > 0) {
  //       configTitle.textContent = `⚙️ AI Agent LeoBot 配置 - ${data[0].name || data[0].id}`;
  //     }
  //   }
  // });

  // // 迁移配置相关消息处理
  // messageHub.on("ConfigPanel:configPathInfo", (data) => {
  //   currentConfigPath.textContent = data.path || "获取失败";
  // });
  // # endregion

  // 这个功能要迁移，然后这个要么变成中转，要么就废弃

  function showStatus(
    statusDiv: HTMLDivElement,
    message: string,
    type: string,
    modalDiv?: HTMLDivElement
  ) {
    statusDiv.textContent = message;
    statusDiv.className = "status " + type;
    statusDiv.style.whiteSpace = "pre-wrap";
    statusDiv.style.display = "block";

    setTimeout(() => {
      statusDiv.style.display = "none";
      if (modalDiv) {
        modalDiv.style.display = "none";
      }
    }, 5000); // 停留5秒
  }

  console.log("[ConfigPanel] 脚本执行完成");
})();
