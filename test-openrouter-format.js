/**
 * Test script to verify OpenRouter format parsing
 */

// Import the parseToolCalls function logic
function parseToolCalls(text) {
  const toolCalls = [];
  let content = text;

  console.log('=== Testing OpenRouter Format Parsing ===');
  console.log('Input text length:', text.length);
  console.log('Input text preview:', text.substring(0, 300) + (text.length > 300 ? '...' : ''));

  // Method 1: Code block format
  const toolCallRegex = /```(?:tool_calls?|tool_code|json)\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = toolCallRegex.exec(text)) !== null) {
    console.log('Found tool call block:', match[1].trim().substring(0, 100));
    try {
      const toolCallJson = JSON.parse(match[1].trim());
      // Validate this is actually a tool call (must have name field)
      if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
        console.log('Skipping JSON block - no valid "name" field');
        continue;
      }
      const toolCall = {
        id: `tc_${Date.now()}_${toolCalls.length}`,
        name: toolCallJson.name,
        arguments: toolCallJson.arguments || {},
      };
      toolCalls.push(toolCall);
      console.log('Parsed tool call:', { name: toolCall.name, args: toolCall.arguments });
      // Remove tool call from content
      content = content.replace(match[0], '').trim();
    } catch (e) {
      console.log('Failed to parse tool call JSON, trying to fix truncated JSON:', e.message);
      // Try to fix truncated JSON by adding missing closing braces
      let fixedJson = match[1].trim();
      try {
        // Try to fix common truncation issues
        // Add missing closing braces/brackets
        let openBraces = (fixedJson.match(/\{/g) || []).length;
        let closeBraces = (fixedJson.match(/\}/g) || []).length;
        let openBrackets = (fixedJson.match(/\[/g) || []).length;
        let closeBrackets = (fixedJson.match(/\]/g) || []).length;

        // Add missing closing braces
        while (closeBraces < openBraces) {
          fixedJson += '}';
          closeBraces++;
        }
        while (closeBrackets < openBrackets) {
          fixedJson += ']';
          closeBrackets++;
        }

        // Remove trailing comma before closing brace/bracket
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

        const toolCallJson = JSON.parse(fixedJson);
        // Validate this is actually a tool call (must have name field)
        if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
          console.log('Skipping fixed JSON block - no valid "name" field');
          continue;
        }
        const toolCall = {
          id: `tc_${Date.now()}_${toolCalls.length}`,
          name: toolCallJson.name,
          arguments: toolCallJson.arguments || {},
        };
        toolCalls.push(toolCall);
        console.log('Parsed fixed tool call:', { name: toolCall.name, args: toolCall.arguments });
        // Remove tool call from content
        content = content.replace(match[0], '').trim();
      } catch (fixError) {
        console.log('Failed to fix truncated JSON:', fixError.message);
        // Still invalid, skip
      }
    }
  }

  // Method 2: Find tool call format with <|tool_call_start|> and <|tool_call_end|>
  const toolCallStartRegex = /<\|tool_call_start\|>\[(.*?)\]<\|tool_call_end\|>/g;
  let startMatch;

  while ((startMatch = toolCallStartRegex.exec(text)) !== null) {
    console.log('Found tool call with <|> format:', startMatch[1].trim().substring(0, 100));
    try {
      // Extract the content between [] and parse as JSON
      const toolCallContent = startMatch[1].trim();

      // Handle case where content might be wrapped in quotes or have extra formatting
      let cleanContent = toolCallContent;
      if (cleanContent.startsWith('"') && cleanContent.endsWith('"')) {
        cleanContent = cleanContent.slice(1, -1);
      }

      // Additional cleanup for malformed JSON that might include text before/after
      // Look for the first { and last } to extract JSON object
      let jsonContent = cleanContent;
      const firstBrace = jsonContent.indexOf('{');
      const lastBrace = jsonContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
      } else {
        // If no JSON braces found, this is not a tool call - skip it
        console.log('Skipping <|> format - no JSON structure found in content');
        continue;
      }

      let toolCallJson;
      try {
        toolCallJson = JSON.parse(jsonContent);
      } catch (jsonError) {
        console.log('Failed to parse JSON, trying to fix truncated JSON:', jsonError.message);
        // Try to fix truncated JSON by adding missing closing braces
        let fixedJson = jsonContent;
        try {
          // Try to fix common truncation issues
          // Add missing closing braces/brackets
          let openBraces = (fixedJson.match(/\{/g) || []).length;
          let closeBraces = (fixedJson.match(/\}/g) || []).length;
          let openBrackets = (fixedJson.match(/\[/g) || []).length;
          let closeBrackets = (fixedJson.match(/\]/g) || []).length;

          // Add missing closing braces
          while (closeBraces < openBraces) {
            fixedJson += '}';
            closeBraces++;
          }
          while (closeBrackets < openBrackets) {
            fixedJson += ']';
            closeBrackets++;
          }

          // Remove trailing comma before closing brace/bracket
          fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

          toolCallJson = JSON.parse(fixedJson);
        } catch (fixError) {
          console.log('Failed to fix truncated JSON, trying to extract valid JSON object:', fixError.message);
          // Try to extract a valid JSON object from the text
          const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              toolCallJson = JSON.parse(jsonMatch[0]);
            } catch (nestedError) {
              console.log('Still failed to parse extracted JSON:', nestedError.message);
              // If we still can't parse JSON, this is not a valid tool call
              console.log('Skipping <|> format - content is not valid JSON');
              continue;
            }
          } else {
            console.log('No valid JSON object found in content');
            // If no JSON pattern found, this is not a valid tool call
            console.log('Skipping <|> format - content is not valid JSON');
            continue;
          }
        }
      }

      // Validate this is actually a tool call (must have name field)
      if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
        console.log('Skipping <|> format - no valid "name" field');
        continue;
      }
      const toolCall = {
        id: `tc_${Date.now()}_${toolCalls.length}`,
        name: toolCallJson.name,
        arguments: toolCallJson.arguments || {},
      };
      toolCalls.push(toolCall);
      console.log('Parsed <|> tool call:', { name: toolCall.name, args: toolCall.arguments });
      // Remove tool call from content
      content = content.replace(startMatch[0], '').trim();
    } catch (e) {
      console.log('Failed to parse <|> tool call JSON:', e.message);
      // Invalid JSON, skip
    }
  }

  // Method 3: Find tool call format with just <|tool_call|> tags
  const toolCallTagRegex = /<\|tool_call\|>([\s\S]*?)<\|\/tool_call\|>/g;
  let tagMatch;

  while ((tagMatch = toolCallTagRegex.exec(text)) !== null) {
    console.log('Found tool call with <|tool_call|> tags:', tagMatch[1].trim().substring(0, 100));
    try {
      let jsonContent = tagMatch[1].trim();

      // Look for the first { and last } to extract JSON object
      let cleanJsonContent = jsonContent;
      const firstBrace = cleanJsonContent.indexOf('{');
      const lastBrace = cleanJsonContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanJsonContent = cleanJsonContent.substring(firstBrace, lastBrace + 1);
      }

      let toolCallJson;
      try {
        toolCallJson = JSON.parse(cleanJsonContent);
      } catch (jsonError) {
        console.log('Failed to parse JSON in <|tool_call|> tags, trying to fix truncated JSON:', jsonError.message);
        // Try to fix truncated JSON by adding missing closing braces
        let fixedJson = cleanJsonContent;
        try {
          // Try to fix common truncation issues
          // Add missing closing braces/brackets
          let openBraces = (fixedJson.match(/\{/g) || []).length;
          let closeBraces = (fixedJson.match(/\}/g) || []).length;
          let openBrackets = (fixedJson.match(/\[/g) || []).length;
          let closeBrackets = (fixedJson.match(/\]/g) || []).length;

          // Add missing closing braces
          while (closeBraces < openBraces) {
            fixedJson += '}';
            closeBraces++;
          }
          while (closeBrackets < openBrackets) {
            fixedJson += ']';
            closeBrackets++;
          }

          // Remove trailing comma before closing brace/bracket
          fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

          toolCallJson = JSON.parse(fixedJson);
        } catch (fixError) {
          console.log('Failed to fix truncated JSON in <|tool_call|> tags, trying to extract valid JSON object:', fixError.message);
          // Try to extract a valid JSON object from the text
          const jsonMatch = cleanJsonContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              toolCallJson = JSON.parse(jsonMatch[0]);
            } catch (nestedError) {
              console.log('Still failed to parse extracted JSON in <|tool_call|> tags:', nestedError.message);
              continue;
            }
          } else {
            console.log('No valid JSON object found in <|tool_call|> tags content');
            continue;
          }
        }
      }

      // Validate this is actually a tool call (must have name field)
      if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
        console.log('Skipping <|tool_call|> format - no valid "name" field');
        continue;
      }
      const toolCall = {
        id: `tc_${Date.now()}_${toolCalls.length}`,
        name: toolCallJson.name,
        arguments: toolCallJson.arguments || {},
      };
      toolCalls.push(toolCall);
      console.log('Parsed <|tool_call|> tool call:', { name: toolCall.name, args: toolCall.arguments });
      // Remove tool call from content
      content = content.replace(tagMatch[0], '').trim();
    } catch (e) {
      console.log('Failed to parse <|tool_call|> JSON:', e.message);
      // Invalid JSON, skip
    }
  }

  // Method 4: OpenRouter specific format - try common OpenRouter patterns
  // Pattern 1: <|start|>tool_name<|end|>
  const openRouterStartEndRegex = /<\|start\|>(\w+)<\|end\|>/g;
  let openRouterMatch;

  while ((openRouterMatch = openRouterStartEndRegex.exec(text)) !== null) {
    const toolName = openRouterMatch[1];
    console.log('Found OpenRouter start/end pattern:', toolName);

    // Look for JSON arguments in the surrounding context
    // This is a heuristic approach since OpenRouter format doesn't always include arguments in the same pattern
    const beforeMatch = text.substring(0, openRouterMatch.index);
    const afterMatch = text.substring(openRouterMatch.index + openRouterMatch[0].length);

    // Try to find JSON in the text before or after the pattern
    let jsonContent = null;

    // Look for JSON before the pattern
    const beforeJsonMatch = beforeMatch.match(/(\{[\s\S]*?\})\s*$/);
    if (beforeJsonMatch) {
      jsonContent = beforeJsonMatch[1];
    } else {
      // Look for JSON after the pattern
      const afterJsonMatch = afterMatch.match(/^\s*(\{[\s\S]*?\})/);
      if (afterJsonMatch) {
        jsonContent = afterJsonMatch[1];
      }
    }

    let toolCallJson;
    if (jsonContent) {
      try {
        toolCallJson = JSON.parse(jsonContent);
      } catch (jsonError) {
        console.log('Failed to parse JSON for OpenRouter format, trying to fix truncated JSON:', jsonError.message);
        // Try to fix truncated JSON
        let fixedJson = jsonContent;
        try {
          // Try to fix common truncation issues
          let openBraces = (fixedJson.match(/\{/g) || []).length;
          let closeBraces = (fixedJson.match(/\}/g) || []).length;
          let openBrackets = (fixedJson.match(/\[/g) || []).length;
          let closeBrackets = (fixedJson.match(/\]/g) || []).length;

          // Add missing closing braces
          while (closeBraces < openBraces) {
            fixedJson += '}';
            closeBraces++;
          }
          while (closeBrackets < openBrackets) {
            fixedJson += ']';
            closeBrackets++;
          }

          // Remove trailing comma before closing brace/bracket
          fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

          toolCallJson = JSON.parse(fixedJson);
        } catch (fixError) {
          console.log('Failed to fix truncated JSON for OpenRouter format:', fixError.message);
          // Create tool call with just the name if no arguments found
          toolCallJson = { name: toolName };
        }
      }
    } else {
      // No JSON found, create tool call with just the name
      toolCallJson = { name: toolName };
    }

    // Validate this is actually a tool call (must have name field)
    if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
      console.log('Skipping OpenRouter format - no valid "name" field');
      continue;
    }

    const toolCall = {
      id: `tc_${Date.now()}_${toolCalls.length}`,
      name: toolCallJson.name,
      arguments: toolCallJson.arguments || {},
    };
    toolCalls.push(toolCall);
    console.log('Parsed OpenRouter tool call:', { name: toolCall.name, args: toolCall.arguments });

    // Remove tool call from content
    content = content.replace(openRouterMatch[0], '').trim();
  }

  // Pattern 2: <tool_name>arguments</tool_name> format
  const openRouterTagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let tagPatternMatch;

  while ((tagPatternMatch = openRouterTagRegex.exec(text)) !== null) {
    const toolName = tagPatternMatch[1];
    const contentStr = tagPatternMatch[2].trim();
    console.log('Found OpenRouter tag pattern:', toolName);

    let toolCallJson;
    try {
      // Try to parse the content as JSON
      toolCallJson = JSON.parse(contentStr);
    } catch (jsonError) {
      console.log('Failed to parse JSON in OpenRouter tag format, trying to fix truncated JSON:', jsonError.message);
      // Try to fix truncated JSON
      let fixedJson = contentStr;
      try {
        // Try to fix common truncation issues
        let openBraces = (fixedJson.match(/\{/g) || []).length;
        let closeBraces = (fixedJson.match(/\}/g) || []).length;
        let openBrackets = (fixedJson.match(/\[/g) || []).length;
        let closeBrackets = (fixedJson.match(/\]/g) || []).length;

        // Add missing closing braces
        while (closeBraces < openBraces) {
          fixedJson += '}';
          closeBraces++;
        }
        while (closeBrackets < openBrackets) {
          fixedJson += ']';
          closeBrackets++;
        }

        // Remove trailing comma before closing brace/bracket
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

        toolCallJson = JSON.parse(fixedJson);
      } catch (fixError) {
        console.log('Failed to fix truncated JSON in OpenRouter tag format:', fixError.message);
        // Create tool call with just the name if no arguments found
        toolCallJson = { name: toolName };
      }
    }

    // Validate this is actually a tool call (must have name field)
    if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
      console.log('Skipping OpenRouter tag format - no valid "name" field');
      continue;
    }

    const toolCall = {
      id: `tc_${Date.now()}_${toolCalls.length}`,
      name: toolCallJson.name,
      arguments: toolCallJson.arguments || {},
    };
    toolCalls.push(toolCall);
    console.log('Parsed OpenRouter tag tool call:', { name: toolCall.name, args: toolCall.arguments });

    // Remove tool call from content
    content = content.replace(tagPatternMatch[0], '').trim();
  }

  return { content, toolCalls };
}

// Test cases for OpenRouter formats
const testCases = [
  {
    name: 'OpenRouter start/end format',
    text: `Here is my response:

<|start|>suggest_profile_update_user_description<|end|>
{"reason": "Your user description is currently empty, which may reduce your chances of being selected for sailing opportunities."}

This is the rest of my response.`,
    expectedToolCalls: 1
  },
  {
    name: 'OpenRouter tag format',
    text: `Here is my response:

<suggest_profile_update_user_description>{"reason": "Your user description is currently empty"}</suggest_profile_update_user_description>

This is the rest of my response.`,
    expectedToolCalls: 1
  },
  {
    name: 'OpenRouter start/end with truncated JSON',
    text: `Here is my response:

<|start|>suggest_profile_update_user_description<|end|>
{"reason": "Your user description is currently empty, which may reduce your chances of being selected for sailing opportunities. A

This is the rest of my response.`,
    expectedToolCalls: 1
  },
  {
    name: 'OpenRouter tag with truncated JSON',
    text: `Here is my response:

<suggest_profile_update_user_description>{"reason": "Your user description is currently empty, which may reduce your chances of being selected for sailing opportunities. A</suggest_profile_update_user_description>

This is the rest of my response.`,
    expectedToolCalls: 1
  },
  {
    name: 'OpenRouter start/end with no JSON',
    text: `Here is my response:

<|start|>suggest_profile_update_user_description<|end|>

This is the rest of my response.`,
    expectedToolCalls: 1
  },
  {
    name: 'Mixed formats',
    text: `Here is my response:

<|start|>suggest_profile_update_user_description<|end|>
{"reason": "Your user description is empty"}

<suggest_profile_update_certifications>{"reason": "You should add your sailing certifications"}</suggest_profile_update_certifications>

This is the rest of my response.`,
    expectedToolCalls: 2
  },
  {
    name: 'Regular text with no tool calls',
    text: `Here is my response without any tool calls. This is just regular text.`,
    expectedToolCalls: 0
  }
];

// Run tests
console.log('Running OpenRouter format parsing tests...\\n');

let allPassed = true;

testCases.forEach((testCase, index) => {
  console.log(`\\n--- Test ${index + 1}: ${testCase.name} ---`);

  const result = parseToolCalls(testCase.text);
  const passed = result.toolCalls.length === testCase.expectedToolCalls;

  console.log(`Expected tool calls: ${testCase.expectedToolCalls}`);
  console.log(`Actual tool calls: ${result.toolCalls.length}`);
  console.log(`Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (result.toolCalls.length > 0) {
    console.log('Tool calls found:');
    result.toolCalls.forEach((tc, i) => {
      console.log(`  ${i + 1}. ${tc.name}:`, tc.arguments);
    });
  }

  if (!passed) {
    allPassed = false;
  }
});

console.log('\\n=== Test Summary ===');
console.log(`All tests passed: ${allPassed ? '✅ YES' : '❌ NO'}`);

if (allPassed) {
  console.log('\\n🎉 OpenRouter format parsing is working correctly!');
  console.log('The system can now handle:');
  console.log('- OpenRouter <|start|>tool_name<|end|> format');
  console.log('- OpenRouter <tool_name>arguments</tool_name> format');
  console.log('- Truncated JSON with automatic fixing');
  console.log('- Mixed tool call formats');
} else {
  console.log('\\n⚠️  Some tests failed. The OpenRouter parsing logic may need additional work.');
}

export { parseToolCalls, testCases };