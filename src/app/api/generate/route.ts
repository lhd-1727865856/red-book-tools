import { NextRequest } from 'next/server'
import { OpenAI } from 'openai'

// 创建一个 TextEncoder 实例用于编码响应数据
const encoder = new TextEncoder()

// 发送一个 JSON 行
function sendJsonLine(controller: ReadableStreamDefaultController, content: string) {
  // 确保内容不为空
  if (!content.trim()) return
  
  const json = JSON.stringify({ content }) + '\n'
  controller.enqueue(encoder.encode(json))
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const prompt = formData.get('prompt') as string
    const category = formData.get('category') as string
    const baseUrl = formData.get('baseUrl') as string
    const mode = formData.get('mode') as string
    const model = formData.get('model') as string
    const workflowId = formData.get('workflowId') as string
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '') || ''

    if (!prompt || !apiKey) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'coze') {
      if (!workflowId) {
        return new Response(JSON.stringify({ error: '缺少工作流 ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Coze API 调用
      const response = await fetch(`${baseUrl}/${workflowId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: prompt,
          category: category,
        }),
      })

      if (!response.ok) {
        throw new Error('Coze API 调用失败')
      }

      const data = await response.json()
      
      // 创建流式响应
      const stream = new ReadableStream({
        start(controller) {
          // 将文本转换为 Unicode 码点数组，这样可以正确处理表情符号
          const text = data.text
          let currentLine = ''
          let insideMarkdown = false
          let insideEmoji = false
          
          for (let i = 0; i < text.length; i++) {
            const char = text[i]
            currentLine += char
            
            // 检查是否在 Markdown 标记内
            if (char === '`' || char === '*' || char === '#') {
              insideMarkdown = !insideMarkdown
            }
            
            // 检查是否在表情符号内（简单判断）
            if (/[\u{1F300}-\u{1F9FF}]/u.test(char)) {
              insideEmoji = true
            } else if (insideEmoji && /[\u{1F300}-\u{1F9FF}]/u.test(char)) {
              insideEmoji = false
            }
            
            // 当累积了一定数量的字符，且不在特殊标记内时，发送内容
            if (currentLine.length >= 3 && !insideMarkdown && !insideEmoji) {
              sendJsonLine(controller, currentLine)
              currentLine = ''
            }
          }
          
          // 发送剩余内容
          if (currentLine) {
            sendJsonLine(controller, currentLine)
          }
          
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } else {
      // OpenAI API 调用
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl,
      })

      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的小红书${category}类文案写手。你需要根据用户的主题生成文案。
请使用 Markdown 格式输出，文案要求：
1. 标题使用一级标题 (#)，要吸引人，带有emoji
2. 正文要分段，每段都要有emoji，可以使用加粗和斜体增加文案表现力
3. 最后要有3-5个相关话题标签，使用 \`#标签\` 的形式
4. 文案风格要活泼、年轻化，但不要过分夸张
5. 内容要真实可信，有价值`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true,
      })

      const stream = new ReadableStream({
        async start(controller) {
          try {
            console.log('开始处理 OpenAI 流式响应')
            let buffer = ''
            let currentSegment = ''
            let isInSpecialToken = false
            
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content
              if (!content) continue
              
              // 将内容添加到当前片段
              currentSegment += content
              
              // 检查是否在特殊标记内（Markdown 或表情符号）
              if (/[#*`]|[\u{1F300}-\u{1F9FF}]|\p{Extended_Pictographic}/u.test(content)) {
                isInSpecialToken = true
              }
              
              // 检查分段条件
              const shouldSplit = (
                /[。！？.!?]\s*$/.test(currentSegment) || // 句子结束
                /\n/.test(currentSegment) || // 换行
                (!isInSpecialToken && /[，,、]\s*$/.test(currentSegment)) || // 逗号等分隔符
                currentSegment.length > 10 // 累积一定长度
              )
              
              if (shouldSplit) {
                // 将当前片段添加到缓冲区
                buffer += currentSegment
                
                // 发送缓冲区内容
                if (buffer.trim()) {
                  console.log('发送内容片段:', buffer)
                  sendJsonLine(controller, buffer)
                }
                
                // 重置状态
                buffer = ''
                currentSegment = ''
                isInSpecialToken = false
              }
            }
            
            // 发送剩余内容
            if (currentSegment.trim()) {
              buffer += currentSegment
            }
            if (buffer.trim()) {
              console.log('发送最后的内容:', buffer)
              sendJsonLine(controller, buffer)
            }
            
            console.log('流式响应处理完成')
          } catch (error) {
            console.error('流处理错误:', error)
          } finally {
            console.log('关闭流')
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
  } catch (error) {
    console.error('生成失败:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '生成失败' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
} 