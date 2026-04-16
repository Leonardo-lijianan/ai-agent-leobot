import { messageHub } from "./utils/messageHub.js";

(function () {
  let testMarkdownText = ""; // Initialize empty test markdown text

  let isLoading = false;
  let currentAgentMode = true;
  let currentModel: string = "";
  let currentAgent: string = ""; // 存储 agent id（用于后端查询）
  let currentAgentName: string = ""; // 存储 agent name（用于展示）
  let md: any = null;
  let isMarkdownInitialized = false;

  // 初始化 markdown-it
  function initMarkdown() {
    if (isMarkdownInitialized) {
      return;
    }

    if (typeof window.markdownit !== "undefined") {
      md = window.markdownit({
        html: false,
        xhtmlOut: false,
        breaks: false,
        langPrefix: "language-",
        linkify: false,
        typographer: false,
        quotes: "\"\"''",
      });

      if (typeof window.markdownitFootnote !== "undefined") {
        md.use(window.markdownitFootnote);
      }

      if (typeof window.markdownitTaskLists !== "undefined") {
        md.use(window.markdownitTaskLists);
      }

      isMarkdownInitialized = true;
      console.log("Markdown 初始化完成");
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

  /**
   * 加载 Agent 下拉框
   */
  async function loadAgentSelector() {
    console.log("[ChatView] 加载 Agent 下拉框");
    const agentSelect = document.getElementById("agentSelect") as HTMLSelectElement | null;

    const agentListResponse = await messageHub.request("chat:getConfigs", {
      configType: "agent",
    });

    if (agentListResponse.success && agentListResponse.data) {
      const { configs: agents } = agentListResponse.data;
      if (agentSelect) {
        agentSelect.innerHTML = "";
        agents.forEach((agent: any) => {
          const option = document.createElement("option");
          option.value = agent.id; // value 使用 id（传给后端）
          option.dataset.name = agent.name; // 额外存储 name（用于展示）
          option.textContent = agent.name || agent.id;
          agentSelect.appendChild(option);
        });
        // 设置当前选中的 Agent
        if (currentAgent) {
          agentSelect.value = currentAgent;
          console.log("[ChatView] Agent 下拉框已更新，当前选中:", currentAgent);
        } else {
          console.log("[ChatView] Agent 下拉框已更新，共", agents.length, "个 Agent");
        }
      }
    } else {
      console.error("[ChatView] 加载 Agent 列表失败", agentListResponse.error);
    }
  }

  /**
   * 加载 Model 下拉框
   */
  async function loadModelSelector() {
    console.log("[ChatView] 加载 Model 下拉框");
    const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement | null;

    const modelListResponse = await messageHub.request("chat:getConfigs", {
      configType: "model",
    });

    if (modelListResponse.success && modelListResponse.data) {
      const { configs: models } = modelListResponse.data;
      if (modelSelect) {
        modelSelect.innerHTML = "";
        models.forEach((model: any) => {
          const option = document.createElement("option");
          option.value = model.name || model.id;
          option.textContent =
            (model.name || model.id) + (model.modelId ? " (" + model.modelId + ")" : "");
          modelSelect.appendChild(option);
        });
        // 设置当前选中的 Model
        if (currentModel) {
          modelSelect.value = currentModel;
          console.log("[ChatView] Model 下拉框已更新，当前选中:", currentModel);
        } else {
          console.log("[ChatView] Model 下拉框已更新，共", models.length, "个模型");
        }
      }
    } else {
      console.error("[ChatView] 加载 Model 列表失败", modelListResponse.error);
    }
  }

  function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function addMessage(message: { role: string; content: string }) {
    const chatContainer = document.getElementById("chatContainer");
    const chatContent = chatContainer?.querySelector(".chat-content");
    const existingWelcome = chatContent?.querySelector(".welcome");
    if (existingWelcome) {
      existingWelcome.remove();
    }

    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "message-wrapper " + message.role;

    const messageDiv = document.createElement("div");
    messageDiv.className = "message " + message.role;

    const roleText =
      message.role === "user" ? "👤 你" : message.role === "assistant" ? "🤖 AI" : "⚠️ 错误";

    const roleDiv = document.createElement("div");
    roleDiv.className = "message-role";
    roleDiv.textContent = roleText;

    let contentHtml: string;
    if (message.role === "user") {
      contentHtml = escapeHtml(message.content);
    } else {
      if (md) {
        const markdownHtml = md.render(message.content);
        contentHtml =
          typeof window.DOMPurify !== "undefined"
            ? window.DOMPurify.sanitize(markdownHtml)
            : escapeHtml(message.content);
      } else {
        contentHtml = escapeHtml(message.content);
      }
    }

    messageDiv.innerHTML = '<div class="message-content">' + contentHtml + "</div>";

    wrapperDiv.appendChild(roleDiv);
    wrapperDiv.appendChild(messageDiv);
    chatContent?.appendChild(wrapperDiv);
    if (chatContent) {
      chatContent.scrollTop = chatContent.scrollHeight;
    }
  }

  function clearMessages() {
    const chatContainer = document.getElementById("chatContainer");
    const chatContent = chatContainer?.querySelector(".chat-content");
    if (chatContent) {
      chatContent.innerHTML = "";
    }
  }

  function setLoading(loading: boolean) {
    isLoading = loading;
    const sendButton = document.getElementById("sendButton");
    const messageInput = document.getElementById("messageInput");
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
        sendButton.textContent = "发送";
      }
    }
  }

  async function sendMessage() {
    console.log("[ChatView] sendMessage 被调用");

    const messageInput = document.getElementById("messageInput");
    console.log("[ChatView] messageInput:", messageInput);

    if (!messageInput) {
      console.error("[ChatView] messageInput 不存在！");
      return;
    }

    const content = (messageInput as HTMLTextAreaElement).value.trim();
    console.log("[ChatView] 获取到的内容:", content);

    if (!content || isLoading) {
      console.log("[ChatView] 内容为空或正在加载，返回");
      return;
    }

    // 先添加用户消息到聊天框
    console.log("[ChatView] 添加用户消息");
    addMessage({ role: "user", content: content });

    // 清空输入框
    (messageInput as HTMLTextAreaElement).value = "";

    // 设置等待状态
    console.log("[ChatView] 设置等待状态");
    setLoading(true);

    // 发送消息到后端
    console.log("[ChatView] 发送消息到后端");
    const response = await messageHub.request("chat:send", { sendContent: content });
    console.log("[ChatView] 后端响应:", response);

    if (response.success) {
      // 输出 AI 回复
      console.log("[ChatView] 添加 AI 回复");
      addMessage({ role: "assistant", content: response.data.receiveContent });
      setLoading(false);
    } else {
      // error
      console.log("[chat:send] error:" + response.error);
      addMessage({ role: "error", content: response.error });
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  }

  // 绑定事件
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[ChatView] DOMContentLoaded 触发");
    console.log("[ChatView] 开始初始化");

    const sendButton = document.getElementById("sendButton");
    const messageInput = document.getElementById("messageInput");
    const testMarkdownBtn = document.getElementById("testMarkdownBtn");
    const configBtn = document.getElementById("configBtn");
    const modeSelect = document.getElementById("modeSelect") as HTMLSelectElement | null;
    const agentSelect = document.getElementById("agentSelect") as HTMLSelectElement | null;
    const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement | null;
    const agentSelectorGroup = document.getElementById("agentSelectorGroup");
    const currentModelEl = document.getElementById("currentModel");

    // 发送按钮
    if (sendButton) {
      sendButton.addEventListener("click", sendMessage);
    }
    // Ctrl+Enter 发送
    if (messageInput) {
      messageInput.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key === "Enter") {
          sendMessage();
        }
      });
    }
    // 测试 Markdown
    if (testMarkdownBtn) {
      testMarkdownBtn.addEventListener("click", () => {
        addMessage({ role: "assistant", content: testMarkdownText });
      });
    }
    // 配置按钮
    if (configBtn) {
      configBtn.addEventListener("click", async () => {
        const response = await messageHub.request("chat:openConfigPanel", {});
        if (response.success) {
        } else {
          console.log("[chat:openConfigPanel]", response.error);
        }
      });
    }
    // 模式切换
    if (modeSelect) {
      modeSelect.addEventListener("change", async (e) => {
        const agentMode = (e.target as HTMLSelectElement).value === "agent";
        currentAgentMode = agentMode;

        if (agentSelectorGroup) {
          if (agentMode) {
            agentSelectorGroup.classList.add("visible");
          } else {
            agentSelectorGroup.classList.remove("visible");
          }
        }

        const response = await messageHub.request("chat:toggleAgentMode", { enabled: agentMode });
        if (response.success) {
          // ...
        } else {
          // error ...
          console.error("[chat:toggleAgentMode]", response.error);
        }
      });
    }
    // Agent 选择器
    if (agentSelect) {
      agentSelect.addEventListener("change", async (e) => {
        const agentId = (e.target as HTMLSelectElement).value;
        const selectedOption = agentSelect.options[agentSelect.selectedIndex];
        const agentName = selectedOption.dataset.name || agentId;

        const response = await messageHub.request("chat:switchConfig", {
          configType: "agent",
          id: agentId,
        });
        console.log("[ChatView] 收到 switchConfig 响应 (Agent):", response);
        if (response.success) {
          // 更新当前 Agent（id 和 name 都更新）
          currentAgent = agentId;
          currentAgentName = agentName;
          console.log("[ChatView] Agent 已切换:", { id: currentAgent, name: currentAgentName });
        } else {
          // error ...
          console.error("[chat:switchConfig<agnet>]", response.error);
        }
      });
    }
    // Model 选择器
    if (modelSelect) {
      modelSelect.addEventListener("change", async (e) => {
        const modelId = (e.target as HTMLSelectElement).value;
        const response = await messageHub.request("chat:switchConfig", {
          configType: "model",
          id: modelId,
        });
        if (response.success) {
          // 更新当前模型
          currentModel = modelId;
          console.log("[ChatView] 模型已切换:", currentModel);

          // 同时更新当前模型显示
          const currentModelEl = document.getElementById("currentModel");
          if (currentModelEl) {
            // 从下拉框获取显示文本
            const selectedOption = modelSelect.options[modelSelect.selectedIndex];
            currentModelEl.textContent = "当前模型：" + selectedOption.textContent;
            currentModelEl.style.color = "var(--vscode-foreground)";
            console.log("[ChatView] 当前模型显示已更新:", currentModelEl.textContent);
          }
        } else {
          // error ...
          console.error("[chat:switchConfig<model>]", response.error);
        }
      });
    }

    // 发送 ready 请求并主动获取数据
    (async () => {
      const response = await messageHub.request("chat:ready", {});
      if (response.success) {
        // 监听 Model 和 Agent 列表更新通知（来自 ConfigPanel）
        messageHub.on("config>updateList>chat", async (data) => {
          console.log("[ChatView] 收到更新列表通知", data);
          if (data.listType === "model") {
            await loadModelSelector();
          } else if (data.listType === "agent") {
            await loadAgentSelector();
          }
        });

        // 监听聊天记录清空通知（切换 Agent/Model 时触发）
        messageHub.on("chat:clear", async () => {
          console.log("[ChatView] 收到清空聊天记录通知");
          // 清空消息列表
          const chatContainer = document.getElementById("chatContainer");
          const messagesContainer = chatContainer?.querySelector(".chat-content");
          console.log("[ChatView] messagesContainer:", messagesContainer);
          if (messagesContainer) {
            messagesContainer.innerHTML = "";
            console.log("[ChatView] 已清空 messagesContainer");
          } else {
            console.error("[ChatView] 找不到 messagesContainer 元素！");
          }

          // 重新获取当前配置（确保使用最新的 agent 和 model）
          console.log("[ChatView] 重新获取当前配置");
          const globalResponse = await messageHub.request("chat:getCurrentConfig", {
            configType: "global",
          });
          const modelResponse = await messageHub.request("chat:getCurrentConfig", {
            configType: "model",
          });

          if (globalResponse.success && modelResponse.success) {
            const globalConfig = globalResponse.data.config as any;
            const modelConfig = modelResponse.data.config as any;
            currentAgent = globalConfig.currentAgent || "default";
            currentModel = modelConfig.id || "";
            console.log("[ChatView] 当前配置已更新", { currentAgent, currentModel });
          }

          // 主动拉取当前配置的历史记录
          console.log("[ChatView] 准备拉取历史记录，参数:", {
            modelConfigId: currentModel,
            agentConfigId: currentAgent,
          });
          const historyResponse = await messageHub.request("chat:getHistory", {
            modelConfigId: currentModel,
            agentConfigId: currentAgent,
          });

          console.log("[ChatView] 历史记录响应:", historyResponse);

          if (historyResponse.success && historyResponse.data) {
            console.log(
              "[ChatView] 获取到历史记录，条数:",
              historyResponse.data.messages?.length || 0
            );
            console.log("[ChatView] 历史记录内容:", historyResponse.data.messages);
            // 渲染历史消息（使用 addMessage 函数，确保格式一致）
            for (const msg of historyResponse.data.messages) {
              addMessage({ role: msg.role, content: msg.content });
            }
            console.log("[ChatView] 历史记录渲染完成");
          } else {
            console.error("[ChatView] 获取历史记录失败", historyResponse.error);
          }
        });

        // 主动请求当前 global 配置
        const globalResponse = await messageHub.request("chat:getCurrentConfig", {
          configType: "global",
        });
        if (globalResponse.success && globalResponse.data) {
          const globalConfig = globalResponse.data.config as any;
          const agentMode = globalConfig.agentModeEnabled;
          if (modeSelect) {
            modeSelect.value = agentMode ? "agent" : "direct";
            currentAgentMode = agentMode;

            if (agentSelectorGroup) {
              agentSelectorGroup.classList.add(agentMode ? "visible" : "");
            }
          }
        } else {
          console.error("[chat:getCurrentConfig<global>] ", globalResponse.error);
        }
        // 主动请求当前 model 配置
        const modelResponse = await messageHub.request("chat:getCurrentConfig", {
          configType: "model",
        });
        if (modelResponse.success && modelResponse.data) {
          const modelConfig = modelResponse.data.config as any;
          if (modelConfig && modelConfig.id) {
            currentModel = modelConfig.id;
            if (currentModelEl) {
              currentModelEl.textContent =
                "当前模型：" +
                (modelConfig.name || modelConfig.id) +
                (modelConfig.modelId ? " (" + modelConfig.modelId + ")" : "");
              currentModelEl.style.color = "var(--vscode-foreground)";
            }
            console.log("✅ 模型已加载:", { model: modelConfig.id });
            if (modelSelect && modelConfig.id) {
              modelSelect.innerHTML =
                '<option value="' + modelConfig.id + '">' + modelConfig.id + "</option>";
            }
          }
        } else {
          console.error("[chat:getCurrentConfig<model>] ", modelResponse.error);
        }
        // 主动请求当前 agent 配置
        const agentResponse = await messageHub.request("chat:getCurrentConfig", {
          configType: "agent",
        });
        if (agentResponse.success && agentResponse.data) {
          const agentConfig = agentResponse.data.config as any;
          if (agentConfig) {
            currentAgent = agentConfig.id; // 存储 id（用于后端查询）
            currentAgentName = agentConfig.name; // 存储 name（用于展示）
            const agentName = agentConfig.name || "默认助手";
            if (agentSelect && agentName) {
              agentSelect.value = agentConfig.id;
            }
            console.log("✅ Agent 已加载:", { agent: agentConfig.id, name: agentName });
          }
        } else {
          console.error("[chat:getCurrentConfig<agent>] ", agentResponse.error);
        }

        // 主动请求 Model 列表
        const modelListResponse = await messageHub.request("chat:getConfigs", {
          configType: "model",
        });
        if (modelListResponse.success && modelListResponse.data) {
          const { configs: models } = modelListResponse.data;
          if (modelSelect) {
            modelSelect.innerHTML = "";
            models.forEach((model: any) => {
              const option = document.createElement("option");
              option.value = model.name || model.id;
              option.textContent =
                (model.name || model.id) + (model.modelId ? " (" + model.modelId + ")" : "");
              modelSelect.appendChild(option);
            });
          }
        } else {
          console.error("[chat:getCurrentConfig<model>] ", modelResponse.error);
        }

        // 主动加载 Model 下拉框
        await loadModelSelector();

        // 主动加载 Agent 下拉框
        await loadAgentSelector();

        // 主动请求历史记录
        const historyResponse = await messageHub.request("chat:getHistory", {
          modelConfigId: currentModel,
          agentConfigId: currentAgent,
        });
        if (historyResponse.success && historyResponse.data) {
          const { messages } = historyResponse.data;
          clearMessages();
          messages.forEach((msg: any) => addMessage(msg));
        } else {
          console.error("[chat:getHistory] ", modelResponse.error);
        }

        // 主动请求 获取测试Markdown
        const testMarkdownResponse = await messageHub.request("chat:getTestMarkdown", {});
        if (testMarkdownResponse.success && testMarkdownResponse.data) {
          testMarkdownText = testMarkdownResponse.data.text;
        }
        console.log("[ChatView] Ready 成功");
      } else {
        console.error("[ChatView] Ready 失败:", response.error);
      }
    })();
  });
})();
