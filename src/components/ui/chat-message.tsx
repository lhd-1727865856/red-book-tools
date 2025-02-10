import * as React from "react"
import { cn } from "@/lib/utils"
import { Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEffect, useState } from "react"

export interface ChatMessageProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onCopy'> {
  content: string
  role: 'user' | 'assistant'
  timestamp: number
  onCopy?: (content: string, timestamp: number) => void | Promise<void>
  copiedMessageId?: number | null
  isNewMessage?: boolean
}

export const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ className, content, role, timestamp, onCopy, copiedMessageId, isNewMessage = false, ...props }, ref) => {
    const isUser = role === 'user'
    const [displayContent, setDisplayContent] = useState(isNewMessage ? '' : content)
    const [isTyping, setIsTyping] = useState(false)
    const typeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
    const contentRef = React.useRef<string>(content)
    
    useEffect(() => {
      // 更新 ref 中的内容
      contentRef.current = content
    }, [content])
    
    useEffect(() => {
      if (!isUser && isNewMessage && content !== displayContent) {
        setIsTyping(true)
        
        // 计算需要添加的新内容
        const newContent = content.slice(displayContent.length)
        let currentIndex = 0
        
        const typeNextCharacter = () => {
          if (currentIndex < newContent.length) {
            const char = newContent[currentIndex]
            const nextChar = newContent[currentIndex + 1] || ''
            
            // 检查是否是表情符号（Unicode 范围）
            const isEmoji = /[\u{1F300}-\u{1F9FF}]|\p{Extended_Pictographic}/u.test(char)
            const isNextEmoji = /[\u{1F300}-\u{1F9FF}]|\p{Extended_Pictographic}/u.test(nextChar)
            
            // 检查是否是 Markdown 标记
            const isMarkdown = /[#*`]/.test(char)
            const isNextMarkdown = /[#*`]/.test(nextChar)
            
            // 决定延迟时间
            let delay = 30 // 默认延迟
            
            if (isEmoji || isMarkdown) {
              // 表情符号或 Markdown 标记立即显示
              delay = 0
            } else if (/[。！？.!?]/.test(char)) {
              // 句号等标点符号后面稍微停顿
              delay = 300
            } else if (/[,，、]/.test(char)) {
              // 逗号等停顿较短
              delay = 150
            }
            
            setDisplayContent(prev => prev + char)
            currentIndex++
            
            // 如果下一个字符是表情符号或 Markdown 标记，立即显示
            if (isNextEmoji || isNextMarkdown) {
              typeNextCharacter()
            } else {
              typeTimeoutRef.current = setTimeout(typeNextCharacter, delay)
            }
          } else {
            setIsTyping(false)
          }
        }
        
        typeNextCharacter()
        
        return () => {
          if (typeTimeoutRef.current) {
            clearTimeout(typeTimeoutRef.current)
          }
        }
      } else if (isUser || !isNewMessage) {
        setDisplayContent(content)
      }
    }, [content, isUser, isNewMessage])

    const markdownContent = React.useMemo(() => (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {(isUser ? content : displayContent).trim()}
      </ReactMarkdown>
    ), [isUser, content, displayContent])
    
    return (
      <div
        ref={ref}
        className={cn(
          "group flex w-full items-start gap-3 px-4",
          isUser ? "flex-row-reverse" : "flex-row",
          "animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out",
          className
        )}
        {...props}
      >
        {/* 头像 */}
        <div className={cn(
          "flex-none w-10 h-10 rounded-xl bg-gradient-to-br shadow-lg flex items-center justify-center text-sm font-medium text-white border border-white/10",
          isUser 
            ? "from-rose-500/90 to-pink-500/90 shadow-rose-500/20" 
            : "from-violet-500 to-indigo-500 shadow-indigo-500/20"
        )}>
          {isUser ? '我' : 'AI'}
        </div>

        {/* 消息内容 */}
        <div className={cn(
          "relative inline-flex flex-col min-w-[60px]",
          "max-w-[85%] group/bubble"
        )}>
          {/* 时间戳 */}
          <div className={cn(
            "mb-2 text-xs text-gray-400/80 opacity-0 group-hover/bubble:opacity-100 transition-all duration-200",
            isUser ? "self-end" : "self-start"
          )}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* 气泡容器 */}
          <div className="relative self-start">
            {/* 气泡背景 */}
            <div className={cn(
              "absolute -inset-2 rounded-3xl blur-xl transition-all duration-300",
              isUser 
                ? "bg-gradient-to-br from-rose-500/20 to-pink-500/20 group-hover/bubble:from-rose-500/30 group-hover/bubble:to-pink-500/30" 
                : "bg-gradient-to-br from-violet-500/10 to-indigo-500/10 group-hover/bubble:from-violet-500/20 group-hover/bubble:to-indigo-500/20"
            )}/>

            {/* 气泡主体 */}
            <div className={cn(
              "relative inline-block rounded-2xl transition-all duration-300",
              isUser 
                ? "bg-gradient-to-br from-rose-500/90 to-pink-500/90 text-white shadow-lg shadow-rose-500/20 py-1.5 px-3" 
                : "bg-white/10 backdrop-blur-md border border-white/10 shadow-xl shadow-black/5 p-4"
            )}>
              {/* Markdown 内容 */}
              <div className={cn(
                "prose prose-sm break-words",
                "prose-p:!my-0 prose-headings:!mb-2 prose-headings:!mt-0",
                "prose-ul:!my-1 prose-ol:!my-1 prose-li:!my-0",
                "prose-pre:!my-2 prose-blockquote:!my-2",
                "[&>*:last-child]:!mb-0",
                "[&>*:first-child]:!mt-0",
                "[&>p]:!leading-normal",
                isUser ? "text-white/95 prose-headings:text-white" : "prose-invert"
              )}>
                {markdownContent}
              </div>

              {/* 打字光标 */}
              {!isUser && isTyping && isNewMessage && (
                <span className="ml-0.5 inline-block w-1 h-4 bg-white/80 animate-pulse" />
              )}

              {/* 复制按钮 */}
              {!isUser && onCopy && (!isTyping || !isNewMessage) && (
                <button
                  onClick={() => onCopy(content, timestamp)}
                  className="absolute -top-3 -right-3 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all opacity-0 group-hover/bubble:opacity-100 shadow-lg backdrop-blur-md border border-white/10 hover:scale-110 active:scale-95"
                  title="复制内容"
                >
                  {copiedMessageId === timestamp ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
)

ChatMessage.displayName = "ChatMessage" 