'use client'

import { Sparkles, ChevronLeft } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect, useRef } from "react"
import { Button as AntButton, Input, Modal, message, ConfigProvider, theme } from 'antd'
import { SettingOutlined, GithubOutlined, HistoryOutlined, CoffeeOutlined, KeyOutlined, CloseOutlined, MessageOutlined, WechatOutlined, MailOutlined } from '@ant-design/icons'
import { cn } from "@/lib/utils"
import { ChatMessage } from "@/components/ui/chat-message"

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

type ApiMode = 'openai' | 'coze'
type ModelType = 'gpt-3.5-turbo' | 'gpt-4' | 'deepseek-chat' | 'claude-3' | 'moonshot-v1-8k'

// API 模式配置映射
interface ApiConfig {
  baseUrl: string
  apiKey: string
  modelType?: ModelType
  workflowId?: string
}

const API_MODE_CONFIG: Record<ApiMode, ApiConfig> = {
  'openai': {
    baseUrl: '',
    apiKey: '',
    modelType: 'deepseek-chat'
  },
  'coze': {
    baseUrl: 'https://api.coze.cn/v1/workflow/run',
    apiKey: '',
    workflowId: ''
  }
}

// 模型对应的 API 地址映射
const MODEL_API_MAP: Record<ModelType, string> = {
  'gpt-3.5-turbo': 'https://api.openai.com/v1',
  'gpt-4': 'https://api.openai.com/v1',
  'deepseek-chat': 'https://api.deepseek.com/v1',
  'claude-3': 'https://api.anthropic.com/v1',
  'moonshot-v1-8k': 'https://api.moonshot.cn/v1',
}

// 本地存储的键名
const STORAGE_KEY = 'chat_history'

// 联系方式常量
const CONTACT_INFO = {
  wechat: 'Lyno5o8',
  email: 'Liu065517a@163.com'
} as const

const ContactModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [messageApi, contextHolder] = message.useMessage()
  const [copyStatus, setCopyStatus] = useState<'wechat' | 'email' | null>(null)
  
  useEffect(() => {
    if (copyStatus === 'wechat') {
      messageApi.success('微信号已复制')
      setCopyStatus(null)
    } else if (copyStatus === 'email') {
      messageApi.success('邮箱已复制')
      setCopyStatus(null)
    }
  }, [copyStatus, messageApi])
  
  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      closeIcon={<CloseOutlined className="text-gray-400 hover:text-white transition-colors" />}
      className="max-w-md [&_.ant-modal-content]:!bg-slate-900 [&_.ant-modal-content]:!p-6 [&_.ant-modal-content]:!rounded-xl [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-white/20 [&_.ant-modal-content]:!shadow-lg [&_.ant-modal-content]:!shadow-black/50 [&_.ant-modal-mask]:!bg-black/50 [&_.ant-modal-mask]:!backdrop-blur-sm"
    >
      {contextHolder}
      <div className="flex items-center gap-3 mb-6">
        <MessageOutlined className="text-[#ff2442]" />
        <span className="text-xl font-semibold text-white">联系方式</span>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <WechatOutlined className="text-[#07c160]" />
          <span className="text-gray-200">微信：{CONTACT_INFO.wechat}</span>
          <AntButton
            size="small"
            onClick={() => {
              navigator.clipboard.writeText(CONTACT_INFO.wechat)
              setCopyStatus('wechat')
            }}
            className="ml-auto !bg-white/5 !border-white/10 !text-gray-300 hover:!text-white hover:!bg-white/10"
          >
            复制
          </AntButton>
        </div>
        <div className="flex items-center gap-2">
          <MailOutlined className="text-[#ff2442]" />
          <span className="text-gray-200">邮箱：{CONTACT_INFO.email}</span>
          <AntButton
            size="small"
            onClick={() => {
              navigator.clipboard.writeText(CONTACT_INFO.email)
              setCopyStatus('email')
            }}
            className="ml-auto !bg-white/5 !border-white/10 !text-gray-300 hover:!text-white hover:!bg-white/10"
          >
            复制
          </AntButton>
        </div>
      </div>
    </Modal>
  )
}

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState('生活')
  const [apiMode, setApiMode] = useState<ApiMode>('openai')
  const [modelType, setModelType] = useState<ModelType>('deepseek-chat')
  const [apiKey, setApiKey] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.deepseek.com/v1')
  const [workflowId, setWorkflowId] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  
  const [messageApi, contextHolder] = message.useMessage()
  
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null)
  const [showContact, setShowContact] = useState(false)
  
  // 获取存储键名
  const getStorageKey = (mode: ApiMode, modelType?: ModelType) => {
    return mode === 'openai' ? `openai:${modelType}` : 'coze'
  }

  // 加载指定模式的配置
  const loadApiModeConfig = (mode: ApiMode, modelType?: ModelType) => {
    // 切换模式时，先清空所有配置
    setApiKey('')
    setApiBaseUrl('')
    setWorkflowId('')
    
    const storageKey = getStorageKey(mode, modelType)
    const savedConfig = localStorage.getItem(storageKey)
    
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as ApiConfig
        setApiKey(config.apiKey || '') // 直接设置，如果不存在就设为空字符串
        
        if (mode === 'openai') {
          setModelType(modelType || 'deepseek-chat')
          setApiBaseUrl(config.baseUrl || MODEL_API_MAP[modelType || 'deepseek-chat'])
        } else {
          setApiBaseUrl(config.baseUrl || API_MODE_CONFIG.coze.baseUrl)
          setWorkflowId(config.workflowId || '') // 直接设置，如果不存在就设为空字符串
        }
      } catch (error) {
        console.error(`Failed to parse ${mode} config:`, error)
        // 加载失败时使用默认配置
        if (mode === 'openai') {
          setApiBaseUrl(MODEL_API_MAP[modelType || 'deepseek-chat'])
          setModelType(modelType || 'deepseek-chat')
        } else {
          setApiBaseUrl(API_MODE_CONFIG.coze.baseUrl)
        }
      }
    } else {
      // 没有保存的配置时使用默认配置
      if (mode === 'openai') {
        setApiBaseUrl(MODEL_API_MAP[modelType || 'deepseek-chat'])
        setModelType(modelType || 'deepseek-chat')
      } else {
        setApiBaseUrl(API_MODE_CONFIG.coze.baseUrl)
      }
    }
  }

  // 加载指定模型的配置
  const loadModelConfig = (model: ModelType) => {
    const storageKey = getStorageKey('openai', model)
    const savedConfig = localStorage.getItem(storageKey)
    
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as ApiConfig
        setApiBaseUrl(config.baseUrl || MODEL_API_MAP[model])
        setApiKey(config.apiKey || '') // 直接设置，如果不存在就设为空字符串
      } catch (error) {
        console.error('Failed to parse model config:', error)
        setApiBaseUrl(MODEL_API_MAP[model])
        setApiKey('') // 解析失败时设为空字符串
      }
    } else {
      setApiBaseUrl(MODEL_API_MAP[model])
      setApiKey('') // 没有配置时设为空字符串
    }
  }
  
  // 从 localStorage 加载配置
  useEffect(() => {
    const savedApiMode = localStorage.getItem('api_mode')
    if (savedApiMode && (savedApiMode === 'openai' || savedApiMode === 'coze')) {
      setApiMode(savedApiMode)
      if (savedApiMode === 'openai') {
        // 尝试加载上次使用的模型
        const lastModel = localStorage.getItem('last_model') as ModelType
        loadApiModeConfig(savedApiMode, lastModel || 'deepseek-chat')
      } else {
        loadApiModeConfig(savedApiMode)
      }
    }
  }, [])

  // 从 localStorage 加载历史消息
  useEffect(() => {
    const savedMessages = localStorage.getItem(STORAGE_KEY)
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages)
        setMessages(parsedMessages)
      } catch (error) {
        console.error('Failed to parse saved messages:', error)
      }
    }
  }, [])

  // 保存配置
  const handleSaveSettings = () => {
    const storageKey = getStorageKey(apiMode, modelType)
    
    // 根据当前模式保存对应的配置
    const currentConfig: ApiConfig = {
      baseUrl: apiBaseUrl,
      apiKey: apiKey || '',
      ...(apiMode === 'openai' ? { modelType } : { workflowId: workflowId || '' })
    }
    
    localStorage.setItem(storageKey, JSON.stringify(currentConfig))
    messageApi.success('设置已保存')
    setShowSettings(false)
  }

  // 自动滚动到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // 保存消息到 localStorage
  const saveMessages = (newMessages: Message[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages))
    } catch (error) {
      console.error('Failed to save messages:', error)
    }
  }

  // 清空历史记录
  const clearHistory = () => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
    messageApi.success('历史记录已清空')
  }

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return
    if (!apiKey) {
      messageApi.error('请先设置 API Key')
      setShowSettings(true)
      return
    }
    if (apiMode === 'coze' && !workflowId) {
      messageApi.error('请先设置工作流 ID')
      setShowSettings(true)
      return
    }
    setIsLoading(true)
    
    // 添加用户消息
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    saveMessages(newMessages) // 保存更新后的消息
    
    try {
      const formData = new FormData()
      formData.append('prompt', input)
      formData.append('category', activeTab)
      formData.append('baseUrl', apiBaseUrl)
      formData.append('mode', apiMode)
      formData.append('model', modelType)
      if (apiMode === 'coze') {
        formData.append('workflowId', workflowId)
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      // 读取流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = '' // 用于存储未完整的 JSON 字符串

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      // 创建一个新的助手消息用于流式输出
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }
      const updatedMessages = [...newMessages, assistantMessage]
      setMessages(updatedMessages)

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // 将新的数据添加到缓冲区
          const newText = decoder.decode(value, { stream: true })
          if (!newText) continue // 跳过空内容
          
          buffer += newText
          
          // 尝试从缓冲区中提取完整的 JSON 对象
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留最后一个可能不完整的行

          for (const line of lines) {
            if (!line.trim()) continue // 跳过空行
            
            try {
              const data = JSON.parse(line)
              const content = data.content
              console.log('收到新数据:', content) 
              
              // 只处理有效的内容
              if (content && typeof content === 'string') {
                // 更新助手消息的内容
                const newContent = assistantMessage.content + content
                assistantMessage.content = newContent
                
                // 创建一个新的消息数组，确保引用更新
                const newMessagesWithAssistant = [...newMessages, { 
                  ...assistantMessage,
                  content: newContent
                }]
                
                // 更新消息状态并保存到 localStorage
                setMessages(newMessagesWithAssistant)
                saveMessages(newMessagesWithAssistant)
              }
            } catch (e) {
              console.error('解析响应数据失败:', e, '原始数据:', line)
            }
          }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer)
            const content = data.content
            
            if (content && typeof content === 'string') {
              const newContent = assistantMessage.content + content
              const finalMessages = [...newMessages, { 
                ...assistantMessage,
                content: newContent
              }]
              
              // 确保最后的消息也被保存
              setMessages(finalMessages)
              saveMessages(finalMessages)
            }
          } catch (e) {
            console.error('解析最后的响应数据失败:', e)
          }
        }

        // 确保最终的消息被保存
        const finalMessages = [...newMessages, assistantMessage]
        setMessages(finalMessages)
        saveMessages(finalMessages)
        
      } catch (error) {
        console.error('读取流数据时出错:', error)
        throw error
      } finally {
        reader.releaseLock()
      }

      setInput('')
    } catch (error) {
      console.error(error)
      messageApi.error(error instanceof Error ? error.message : '生成失败，请检查网络连接')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && input.trim()) {
        const form = e.currentTarget.form
        if (form) {
          const submitEvent = new Event('submit', { cancelable: true, bubbles: true })
          form.dispatchEvent(submitEvent)
        }
      }
    }
  }

  const tabs = ['生活', '美食', '旅行', '美妆']

  const menuItems = [
    {
      icon: <KeyOutlined className="w-4 h-4" />,
      label: 'API 设置',
      onClick: () => {
        setShowSettings(true)
      }
    },
    {
      icon: <HistoryOutlined className="w-4 h-4" />,
      label: '清空历史',
      onClick: clearHistory
    },
    {
      icon: <GithubOutlined className="w-4 h-4" />,
      label: '项目源码',
      onClick: () => {
        window.open('https://github.com/lhd-1727865856/red-book-tools', '_blank')
      }
    },
    {
      icon: <CoffeeOutlined className="w-4 h-4" />,
      label: '赞赏支持',
      onClick: () => {
        messageApi.success('暂时还不需要赞赏哦，谢谢支持！')
        // TODO: 实现赞赏功能
      }
    },
    {
      icon: <MessageOutlined className="w-4 h-4" />,
      label: '联系我',
      onClick: () => {
        setShowContact(true)
      }
    }
  ]

  // 复制功能
  const handleCopy = (content: string, timestamp: number) => {
    navigator.clipboard.writeText(content)
      .then(() => {
      setCopiedMessageId(timestamp)
      setTimeout(() => setCopiedMessageId(null), 2000)
      messageApi.success('复制成功')
      })
      .catch(() => {
      messageApi.error('复制失败')
      })
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#ff2442',
          borderRadius: 8,
          colorBgContainer: 'rgb(15 23 42)',
          colorBgElevated: 'rgb(15 23 42)',
          colorBorder: 'rgba(255, 255, 255, 0.1)',
          colorText: '#fff',
          colorTextSecondary: 'rgba(255, 255, 255, 0.45)',
          controlItemBgHover: 'rgba(255, 255, 255, 0.05)',
        },
      }}
    >
      <div className="flex h-screen overflow-hidden bg-slate-900">
        {contextHolder}
        {/* 左侧边栏 */}
        <div className={cn(
          "flex-none bg-white/5 backdrop-blur-lg border-r border-white/10 transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex-none p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-[#ff2442] to-[#ff4d64] p-2 rounded-xl shadow-lg shadow-[#ff2442]/20 flex-none">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base font-bold bg-gradient-to-r from-white via-white to-gray-300 text-transparent bg-clip-text truncate">
                      小红书文案生成器
                    </h1>
                  </div>
                )}
              </div>
            </div>

            {/* 导航菜单 */}
            <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={item.onClick}
                  className={cn(
                    "w-full rounded-lg text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center transition-colors",
                    isCollapsed ? "justify-center p-2" : "px-3 py-2 gap-2"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!isCollapsed && item.label}
                </button>
              ))}
            </div>

            {/* 底部边距 */}
            <div className="flex-none h-4"></div>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 顶部标题栏 */}
          <div className="flex-none bg-white/5 backdrop-blur-lg border-b border-white/10">
            <div className="h-[68px] px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="p-2 h-9 w-9 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
                  title={isCollapsed ? "展开菜单" : "收起菜单"}
                >
                  <ChevronLeft className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    isCollapsed ? "rotate-180" : ""
                  )} />
                </button>
                <span className="text-sm font-medium text-gray-200">文案生成</span>
              </div>
            </div>
          </div>

          {/* 聊天内容区域 */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-hidden">
                <div className="h-full relative">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-900 to-[#170211] pointer-events-none" />
                  
                  {/* 聊天区域 */}
                    <div 
                      ref={chatContainerRef}
                    className="h-full overflow-y-auto space-y-6 py-8 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
                    >
                    {messages.map((message, index) => (
                      <ChatMessage
                          key={message.timestamp}
                        {...message}
                        onCopy={handleCopy}
                        copiedMessageId={copiedMessageId}
                        isNewMessage={index === messages.length - 1 && message.role === 'assistant' && isLoading}
                      />
                      ))}
                      {isLoading && (
                      <div className="px-4">
                        <div className="relative group flex w-full items-start gap-3">
                          <div className="relative max-w-[120px] ml-[52px]">
                            <div className="absolute -inset-2 rounded-xl blur-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10" />
                            <div className="relative rounded-xl px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/10 shadow-xl shadow-black/5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* 底部输入区域 */}
              <div className="flex-none p-4 bg-slate-900/50 backdrop-blur-xl border-t border-white/10">
                <form onSubmit={handleGenerate} className="max-w-4xl mx-auto space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-400">选择文案类型：</span>
                        <div className="flex flex-wrap gap-1.5">
                          {tabs.map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setActiveTab(tab)}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-xs transition-all duration-300",
                                activeTab === tab
                                  ? 'bg-gradient-to-r from-[#ff2442] to-[#ff4d64] text-white font-medium shadow-lg shadow-[#ff2442]/20 scale-105 ring-2 ring-[#ff2442]/50'
                                  : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white hover:shadow-lg hover:shadow-[#ff2442]/10'
                          )}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>
                      </div>

                  <div className="relative">
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#ff2442]/20 to-[#ff4d64]/20 blur-xl transition-all group-focus-within:from-[#ff2442]/30 group-focus-within:to-[#ff4d64]/30" />
                        <div className="relative">
                      <div className="relative rounded-xl overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/5 bg-white/10 border border-white/10 group">
                          <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                          placeholder={`写下你想要生成的${activeTab}文案主题...`}
                          className="min-h-[100px] max-h-[200px] border-none bg-transparent text-white placeholder:text-gray-400 resize-none p-4 pr-24 text-sm focus:ring-0"
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                            <Button 
                              type="submit" 
                            className={cn(
                              "bg-gradient-to-r from-[#ff2442] to-[#ff4d64] text-white rounded-lg px-4 h-9 transition-all flex items-center gap-1.5 shadow-lg shadow-[#ff2442]/20",
                              "hover:scale-105 hover:shadow-xl hover:shadow-[#ff2442]/30",
                              "active:scale-95",
                              "disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed",
                              "text-sm font-medium"
                            )}
                            disabled={isLoading || (!input.trim())}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {isLoading ? '生成中' : '生成'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  <p className="text-[10px] text-gray-500 text-center">
                    按 Enter 发送，Shift + Enter 换行
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* 设置弹窗 */}
        <Modal
          title={
            <div className="flex items-center gap-3">
              <SettingOutlined className="text-[#ff2442]" />
              <span className="text-xl font-semibold text-white">API 设置</span>
            </div>
          }
          open={showSettings}
          onCancel={() => setShowSettings(false)}
          footer={[
            <AntButton key="cancel" onClick={() => setShowSettings(false)} className="hover:!bg-white/5 !text-gray-300 hover:!text-white !border-white/10">
              取消
            </AntButton>,
            <AntButton
              key="submit"
              type="primary"
              onClick={handleSaveSettings}
              className="!bg-gradient-to-r from-[#ff2442] to-[#ff4d64] !text-white hover:!opacity-90 !border-none"
            >
              保存
            </AntButton>
          ]}
          className="max-w-md [&_.ant-modal-content]:!bg-slate-900 [&_.ant-modal-content]:!p-6 [&_.ant-modal-content]:!rounded-xl [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-white/20 [&_.ant-modal-content]:!shadow-lg [&_.ant-modal-content]:!shadow-black/50 [&_.ant-modal-mask]:!bg-black/50 [&_.ant-modal-mask]:!backdrop-blur-sm"
          centered
          closeIcon={<CloseOutlined className="text-gray-400 hover:text-white transition-colors" />}
        >
          <div className="space-y-6 mt-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  API 模式
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setApiMode('openai')
                      // 尝试加载上次使用的模型的配置
                      const lastModel = localStorage.getItem('last_model') as ModelType || modelType
                      const storageKey = getStorageKey('openai', lastModel)
                      const savedConfig = localStorage.getItem(storageKey)
                      
                      if (savedConfig) {
                        try {
                          const config = JSON.parse(savedConfig) as ApiConfig
                          setModelType(lastModel)
                          setApiBaseUrl(config.baseUrl || MODEL_API_MAP[lastModel])
                          setApiKey(config.apiKey || '') // 直接设置，如果不存在就设为空字符串
                        } catch (error) {
                          console.error('Failed to load last model config:', error)
                          loadApiModeConfig('openai', lastModel)
                        }
                      } else {
                        loadApiModeConfig('openai', lastModel)
                      }
                      localStorage.setItem('api_mode', 'openai')
                    }}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg text-sm transition-all",
                      apiMode === 'openai'
                        ? 'bg-gradient-to-r from-[#ff2442] to-[#ff4d64] text-white font-medium shadow-lg shadow-[#ff2442]/20'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
                    )}
                  >
                    OpenAI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      messageApi.error('Coze 模式暂未开放')
                      // setApiMode('coze')
                      // // 加载 Coze 模式的配置
                      // const storageKey = getStorageKey('coze')
                      // const savedConfig = localStorage.getItem(storageKey)
                      
                      // if (savedConfig) {
                      //   try {
                      //     const config = JSON.parse(savedConfig) as ApiConfig
                      //     setApiBaseUrl(config.baseUrl || API_MODE_CONFIG.coze.baseUrl)
                      //     setApiKey(config.apiKey || '') // 直接设置，如果不存在就设为空字符串
                      //     setWorkflowId(config.workflowId || '') // 直接设置，如果不存在就设为空字符串
                      //   } catch (error) {
                      //     console.error('Failed to load coze config:', error)
                      //     loadApiModeConfig('coze')
                      //   }
                      // } else {
                      //   loadApiModeConfig('coze')
                      // }
                      // localStorage.setItem('api_mode', 'coze')
                    }}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg text-sm transition-all",
                      apiMode === 'coze'
                        ? 'bg-gradient-to-r from-[#ff2442] to-[#ff4d64] text-white font-medium shadow-lg shadow-[#ff2442]/20'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
                    )}
                  >
                    Coze
                  </button>
                </div>
              </div>

              {apiMode === 'openai' && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    模型选择
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['gpt-3.5-turbo', 'gpt-4', 'deepseek-chat', 'claude-3', 'moonshot-v1-8k'].map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => {
                          const modelType = model as ModelType
                          // 加载该模型的配置
                          const storageKey = getStorageKey('openai', modelType)
                          const savedConfig = localStorage.getItem(storageKey)
                          
                          if (savedConfig) {
                            try {
                              const config = JSON.parse(savedConfig) as ApiConfig
                              setModelType(modelType)
                              setApiBaseUrl(config.baseUrl || MODEL_API_MAP[modelType])
                              setApiKey(config.apiKey || '') // 直接设置，如果不存在就设为空字符串
                            } catch (error) {
                              console.error('Failed to load model config:', error)
                              loadModelConfig(modelType)
                            }
                          } else {
                            setModelType(modelType)
                            loadModelConfig(modelType)
                          }
                          localStorage.setItem('last_model', modelType)
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm transition-all",
                          modelType === model
                            ? 'bg-gradient-to-r from-[#ff2442] to-[#ff4d64] text-white font-medium shadow-lg shadow-[#ff2442]/20'
                            : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
                        )}
                      >
                        {model === 'moonshot-v1-8k' ? 'Kimi' : model}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  API 地址
                </label>
                <Input
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder={MODEL_API_MAP[modelType]}
                  className="!bg-white/5 !border-white/10 !text-white placeholder:!text-gray-500"
                  suffix={
                    <button
                      type="button"
                      onClick={() => setApiBaseUrl(MODEL_API_MAP[modelType])}
                      className="text-xs text-[#ff2442] hover:text-[#ff4d64] transition-colors"
                    >
                      重置默认
                    </button>
                  }
                />
                <p className="mt-1 text-xs text-gray-400">
                  当前使用的是 {modelType === 'moonshot-v1-8k' ? 'Kimi' : modelType} 的默认 API 地址
                </p>
              </div>

              {apiMode === 'coze' && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    工作流 ID
                  </label>
                  <Input
                    value={workflowId}
                    onChange={(e) => setWorkflowId(e.target.value)}
                    placeholder="输入 Coze 工作流 ID"
                    className="!bg-white/5 !border-white/10 !text-white placeholder:!text-gray-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  API Key
                </label>
                <Input.Password
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiMode === 'openai' ? "sk-..." : "输入 Coze API Key"}
                  className="!bg-white/5 !border-white/10 !text-white placeholder:!text-gray-500 [&_.ant-input-password-icon]:!text-gray-400"
                />
              </div>
            </div>
          </div>
        </Modal>
        
        {/* 联系方式弹窗 */}
        <ContactModal open={showContact} onClose={() => setShowContact(false)} />
      </div>
    </ConfigProvider>
  )
}
