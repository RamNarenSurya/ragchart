import { config } from '../../config/index.js';
import { VectorSearchResult } from '../vector/vectorStore.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export interface ChatMessageContext {
  role: 'user' | 'assistant';
  content: string;
}

export interface GroundedResponse {
  answer: string;
  sources: {
    documentId: string;
    documentName: string;
    pageNumber: number;
    similarityScore: number;
  }[];
}

export async function generateGroundedAnswer(
  userQuestion: string,
  retrievedChunks: VectorSearchResult[],
  history: ChatMessageContext[] = []
): Promise<GroundedResponse> {
  // If no chunks were returned or matched the similarity threshold
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      answer:
        "I couldn't find this information in the college knowledge base. Please check the official college notices or contact the administration.",
      sources: [],
    };
  }

  // Build unique sources map
  const uniqueSourcesMap = new Map<string, { documentId: string; documentName: string; pageNumber: number; similarityScore: number }>();

  retrievedChunks.forEach((chunk) => {
    const key = `${chunk.documentId}-p${chunk.pageNumber}`;
    if (!uniqueSourcesMap.has(key)) {
      uniqueSourcesMap.set(key, {
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        pageNumber: chunk.pageNumber,
        similarityScore: chunk.similarityScore,
      });
    }
  });

  const sources = Array.from(uniqueSourcesMap.values());

  // Format context for RAG
  const contextString = retrievedChunks
    .map(
      (chunk, idx) =>
        `[Source ${idx + 1}: ${chunk.documentName} (Page ${chunk.pageNumber})]\n${chunk.content}`
    )
    .join('\n\n');

  const historyString = history
    .slice(-6)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');

  const systemPrompt = `You are an expert, friendly, and official College AI Assistant.

GROUNDING & CONCEPT EXPLANATION INSTRUCTIONS:
1. Always ground your response in the official document Context provided below. Mention the relevant document name and page number.
2. If the user asks to EXPLAIN, TEACH, or PROVIDE DETAILS about a concept, topic, or module listed in the Context (such as "Variables and constants", "Two Pointers", "Sliding Window", "Brute Force", "Data Structures", "Scholarship Eligibility", "Library Rules"):
   - Clearly define and EXPLAIN how the concept works in comprehensive detail.
   - Provide step-by-step breakdowns, key principles, and practical C/programming code snippets or math examples where applicable.
   - List all prescribed practice problems, requirements, rules, deadlines, or sub-topics specified in the Context.
3. STRICT ISOLATION REQUIREMENT: Provide ONLY the exact concept, topic, or Day requested by the user. Do NOT include unrelated concepts, other modules, or extra context topics that the user did not ask for.
4. If the question is completely unrelated to any college topic or document in the Context, state: "I couldn't find this information in the college knowledge base. Please check the official college notices or contact the administration."
5. Format your response beautifully using markdown (headers, bold text, bullet lists, code blocks) so students get a high-quality, comprehensive educational answer.

Context:
${contextString}

${historyString ? `Conversation History:\n${historyString}\n` : ''}
Question:
${userQuestion}`;

  // 1. Try OpenAI API if OPENAI_API_KEY is configured
  if (config.openaiApiKey) {
    try {
      const openai = new OpenAI({ apiKey: config.openaiApiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.2,
      });
      const text = completion.choices[0]?.message?.content;
      if (text) {
        return {
          answer: text.trim(),
          sources,
        };
      }
    } catch (err) {
      console.warn('⚠️ OpenAI LLM API error, trying next provider:', (err as Error).message);
    }
  }

  // 2. Try Gemini API if GEMINI_API_KEY is configured
  if (config.geminiApiKey) {
    const candidateModels = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'];
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);

    for (const modelName of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(systemPrompt);
          const text = result.response.text();
          if (text) {
            return {
              answer: text.trim(),
              sources,
            };
          }
        } catch (err: any) {
          console.warn(`⚠️ Gemini model '${modelName}' attempt ${attempt} error:`, err.message);
          if (attempt === 1 && (err.message?.includes('503') || err.message?.includes('overloaded') || err.message?.includes('high demand'))) {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
          break; // Try next model candidate
        }
      }
    }
    console.warn('⚠️ Gemini LLM API error on candidate models, using grounded local synthesis fallback.');
  }

  // 3. Grounded Local Synthesis Fallback
  const answer = synthesizeGroundedResponse(userQuestion, retrievedChunks);
  return {
    answer,
    sources,
  };
}

const CONCEPT_EXPLANATIONS: Record<string, { desc: string; code?: string }> = {
  'variables and constants': {
    desc: 'A variable is a named memory location to store data that can change during program execution (e.g., `int score = 95;`). A constant is a fixed value defined using `const` or `#define` whose value cannot be altered after declaration.',
    code: 'int age = 21; // Variable\nconst float PI = 3.14159; // Constant',
  },
  'data types': {
    desc: 'Specifies the size and type of values a variable can hold. Primitive types in C include `int` (integers, 4 bytes), `float` (decimals, 4 bytes), `double` (high-precision decimals, 8 bytes), and `char` (single characters, 1 byte).',
    code: 'int x = 10;\nfloat gpa = 3.85;\nchar grade = \'A\';',
  },
  'input and output': {
    desc: 'Standard I/O functions provided by `<stdio.h>`. `printf()` formats and prints text to the console, while `scanf()` reads formatted input from standard user input pointers.',
    code: 'int n;\nprintf("Enter a number: ");\nscanf("%d", &n);',
  },
  'arithmetic, relational and logical operators': {
    desc: 'Operators perform mathematical and logical evaluation. Arithmetic (`+`, `-`, `*`, `/`, `%`), Relational (`==`, `!=`, `<`, `>`, `<=`, `>=`), Logical (`&&` AND, `||` OR, `!` NOT).',
    code: 'if (a > 0 && b != 0) {\n    int remainder = a % b;\n}',
  },
  'type casting': {
    desc: 'Converting a variable from one data type to another. Implicit casting happens automatically (e.g., int to float), while explicit casting is specified manually e.g. `(float)a / b`.',
    code: 'int total = 17, count = 4;\nfloat avg = (float)total / count; // avg = 4.25',
  },
  'if, else, nested conditions': {
    desc: 'Conditional branching structures. `if` executes a block if true, `else` handles alternative execution paths, and nested conditions place `if` statements inside another `if` block.',
    code: 'if (score >= 90) printf("Grade A\\n");\nelse if (score >= 75) printf("Grade B\\n");\nelse printf("Grade C\\n");',
  },
  'for, while, do-while': {
    desc: 'Loop control structures. `for` loop is used for counter-based iterations, `while` checks condition before loop execution, and `do-while` executes the body at least once before checking the condition.',
    code: 'for (int i = 1; i <= 5; i++) {\n    printf("Iteration %d\\n", i);\n}',
  },
  'time and space complexity': {
    desc: 'Performance metrics using Big-O notation. Time complexity measures how execution count grows with input size $N$ (e.g. $O(1), O(N), O(N^2)$). Space complexity measures total auxiliary memory allocated.',
    code: '// O(N) Time Complexity\nfor (int i = 0; i < N; i++) {\n    sum += arr[i];\n}',
  },
  'two-pointer technique': {
    desc: 'An algorithmic technique using two indices (pointers) to traverse an array or string from opposite ends or same direction simultaneously, reducing $O(N^2)$ searches to $O(N)$ time.',
    code: 'int L = 0, R = N - 1;\nwhile (L < R) {\n    int sum = arr[L] + arr[R];\n    if (sum == target) return 1;\n    else if (sum < target) L++;\n    else R--;\n}',
  },
  'left and right pointers': {
    desc: 'Opposite-direction two pointers initialized at array boundaries (`L = 0`, `R = N - 1`), moving inwards to solve pair sum, palindrome, and reversing problems.',
    code: 'int left = 0, right = strLen - 1;\nwhile (left < right) {\n    if (str[left] != str[right]) return false;\n    left++; right--;\n}',
  },
  'opposite-direction pointers': {
    desc: 'Pointers starting at opposite ends of a sorted array or string moving towards the center to locate target pairs or test symmetry.',
    code: 'while (left < right) { ... left++; right--; }',
  },
  'same-direction pointers': {
    desc: 'Fast and slow pointers moving in the same direction at different speeds to detect cycles or remove duplicates in-place.',
    code: 'int slow = 0;\nfor (int fast = 0; fast < N; fast++) {\n    if (arr[fast] != 0) arr[slow++] = arr[fast];\n}',
  },
  'in-place processing': {
    desc: 'Modifying the array or data structure directly without creating auxiliary arrays, using $O(1)$ extra memory space.',
    code: '// Swap in-place\nint temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;',
  },
};

function synthesizeGroundedResponse(
  question: string,
  chunks: VectorSearchResult[]
): string {
  if (!chunks || chunks.length === 0) {
    return "I couldn't find this information in the college knowledge base. Please check the official college notices or contact the administration.";
  }

  const qLower = question.toLowerCase();
  const dayMatch = qLower.match(/\b(day|module|unit|section|rule|part)\s*(\d+)\b/i);

  let targetChunks = chunks;
  if (dayMatch) {
    const sectionName = dayMatch[1].toLowerCase();
    const sectionNum = dayMatch[2];
    const exactRegex = new RegExp(`\\b${sectionName}\\s*${sectionNum}\\b`, 'i');

    const matchingTarget = chunks.filter((c) => exactRegex.test(c.content));
    if (matchingTarget.length > 0) {
      targetChunks = matchingTarget;
    }
  }

  const topChunk = targetChunks[0];

  let res = `## 🎓 Grounded Response & Detailed Concept Explanation\n\n`;
  res += `**Source Document:** \`${topChunk.documentName}\` *(Page ${topChunk.pageNumber})*\n\n`;

  const uniqueLines = new Set<string>();
  const conceptItems: string[] = [];
  const practiceProblems: string[] = [];

  for (const c of targetChunks) {
    const rawLines = c.content.split('\n').map((l) => l.trim()).filter(Boolean);
    let inConcepts = false;
    let inLeetcode = false;

    for (const line of rawLines) {
      const cleanLine = line.replace(/^[\-*]\s*/, '').trim();

      if (dayMatch) {
        const otherDay = line.match(/\b(day|module|unit|section)\s*(\d+)\b/i);
        if (otherDay && otherDay[2] !== dayMatch[2]) {
          break;
        }
      }

      if (/^Concepts/i.test(cleanLine)) {
        inConcepts = true;
        inLeetcode = false;
        continue;
      }
      if (/(LeetCode Practice|Practice Problems|LeetCode)/i.test(cleanLine)) {
        inConcepts = false;
        inLeetcode = true;
        continue;
      }
      if (/(Scenario-Based|Day\s+\d+|Module\s+\d+)/i.test(cleanLine)) {
        inConcepts = false;
        inLeetcode = false;
      }

      if (inConcepts && cleanLine) {
        if (!conceptItems.includes(cleanLine)) conceptItems.push(cleanLine);
      } else if (inLeetcode && cleanLine) {
        if (cleanLine.length > 2 && !practiceProblems.includes(cleanLine)) {
          practiceProblems.push(cleanLine);
        }
      } else if (/leetcode/i.test(cleanLine) || /practice problem/i.test(cleanLine)) {
        if (cleanLine.length > 2 && !practiceProblems.includes(cleanLine)) {
          practiceProblems.push(cleanLine);
        }
      } else if (!line.startsWith('') && line.length > 5) {
        uniqueLines.add(line);
      }
    }
  }

  // If user specifically asked for LeetCode or practice problems, prioritize practiceProblems
  const isLeetcodeQuery = /leetcode|practice|problem/i.test(qLower);

  // Filter concepts if user query targets a specific concept/topic
  let targetConceptItems = conceptItems;
  if (!dayMatch && !isLeetcodeQuery) {
    const itemStopWords = new Set(['and', 'or', 'of', 'in', 'the', 'a', 'an', 'to', 'for', 'with', 'by', 'is', 'are', 'what', 'how', 'explain']);
    const specificMatches = conceptItems.filter((item) => {
      const itemLower = item.toLowerCase();
      const itemWords = itemLower.split(/[^a-z0-9]+/i).filter((w) => w.length >= 3 && !itemStopWords.has(w));
      if (itemWords.length === 0) return false;
      return itemWords.every((w) => qLower.includes(w)) || qLower.includes(itemLower);
    });

    if (specificMatches.length > 0) {
      targetConceptItems = specificMatches;
    }
  }

  const isTargetedQuery = dayMatch || isLeetcodeQuery || (targetConceptItems.length > 0 && targetConceptItems.length < conceptItems.length);

  if (targetConceptItems.length > 0 && (!isLeetcodeQuery || conceptItems.length <= 3)) {
    res += `### 💡 Key Concepts & Technical Explanations\n\n`;
    targetConceptItems.forEach((item, idx) => {
      const key = item.toLowerCase();
      const info = CONCEPT_EXPLANATIONS[key];

      res += `#### ${idx + 1}. **${item}**\n`;
      if (info) {
        res += `- **Explanation**: ${info.desc}\n`;
        if (info.code) {
          res += `- **C Code Example**:\n\`\`\`c\n${info.code}\n\`\`\`\n`;
        }
      } else {
        res += `- **Explanation**: Essential technical concept and algorithmic principle specified in the official college syllabus.\n`;
      }
      res += `\n`;
    });
  }

  if (practiceProblems.length > 0) {
    res += `### 💻 Prescribed LeetCode Practice Problems\n\n`;
    practiceProblems.forEach((prob, idx) => {
      const formattedProb = prob.replace(/^\d+\.\s*/, '');
      res += `${idx + 1}. **${formattedProb}**\n`;
      res += `   - *Platform*: LeetCode / HackerRank\n`;
      res += `   - *Action*: Solve this practice problem to solidify array, pointer, and complexity concepts.\n\n`;
    });
  } else if (isLeetcodeQuery) {
    res += `### 💻 Prescribed LeetCode Practice Problems\n\n`;
    res += `1. **Two Sum** *(LeetCode #1)* - Practice array lookup and two-pointer / hashing logic.\n`;
    res += `2. **Best Time to Buy and Sell Stock** *(LeetCode #121)* - Practice single pass & dynamic tracking.\n`;
    res += `3. **Contains Duplicate** *(LeetCode #217)* - Practice duplicate detection algorithms.\n\n`;
  }

  // Only append general overview lines if no specific concept or day was targeted
  if (uniqueLines.size > 0 && !isTargetedQuery && targetConceptItems.length === 0) {
    res += `### 📖 Document Context Overview\n\n`;
    res += Array.from(uniqueLines).slice(0, 5).join('\n\n');
  }

  return res.trim();
}
