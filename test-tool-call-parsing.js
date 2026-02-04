/**
 * Test script to verify tool call parsing fixes
 */

// Import the parseToolCalls function logic
function parseToolCalls(text) {
  const toolCalls = [];
  let content = text;

  console.log('=== Testing Tool Call Parsing ===');
  console.log('Input text length:', text.length);
  console.log('Input text preview:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));

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

  return { content, toolCalls };
}

// Test cases
const testCases = [
  {
    name: 'Complete tool call in code block',
    text: `Here is my response:

\`\`\`tool_call
{"name": "suggest_profile_update_user_description", "arguments": {"reason": "Your user description is currently empty, which may reduce your chances of being selected for sailing opportunities."}}
\`\`\`

This is the rest of my response.`,
    expectedToolCalls: 1
  },
  {
    name: 'Truncated tool call in code block',
    text: `Here is my response:

\`\`\`tool_call
{"name": "suggest_profile_update_user_description", "arguments": {"reason": "Your user description is currently empty, which may reduce your chances of being selected for sailing opportunities. A
\`\`\`

This is the rest of my response.`,
    expectedToolCalls: 1
  },
  {
    name: 'Multiple tool calls',
    text: `Here is my response:

\`\`\`tool_call
{"name": "suggest_profile_update_user_description", "arguments": {"reason": "Your user description is empty"}}
\`\`\`

\`\`\`tool_call
{"name": "search_legs", "arguments": {"departurePort": "Barcelona", "maxDistance": 500}}
\`\`\`

This is the rest of my response.`,
    expectedToolCalls: 2
  },
  {
    name: 'No tool calls',
    text: `Here is my response without any tool calls. This is just regular text.`,
    expectedToolCalls: 0
  },
  {
    name: 'Invalid JSON in tool call',
    text: `Here is my response:

\`\`\`tool_call
{"name": "suggest_profile_update_user_description", "arguments": {invalid json}
\`\`\`

This is the rest of my response.`,
    expectedToolCalls: 0
  }
];

// Run tests
console.log('Running tool call parsing tests...\n');

let allPassed = true;

testCases.forEach((testCase, index) => {
  console.log(`\n--- Test ${index + 1}: ${testCase.name} ---`);

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

console.log('\n=== Test Summary ===');
console.log(`All tests passed: ${allPassed ? '✅ YES' : '❌ NO'}`);

if (allPassed) {
  console.log('\n🎉 Tool call parsing is working correctly!');
  console.log('The system can now handle:');
  console.log('- Complete tool calls');
  console.log('- Truncated tool calls with JSON fixing');
  console.log('- Multiple tool calls');
  console.log('- Invalid JSON gracefully');
} else {
  console.log('\n⚠️  Some tests failed. The parsing logic may need additional work.');
}

export { parseToolCalls, testCases };