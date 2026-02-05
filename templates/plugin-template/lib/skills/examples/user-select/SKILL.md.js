var Skill_user_select = {
  "name": "user-select",
  "title": "User Selection",
  "description": "Present users with choices and collect their selections for interactive decision-making",
  "instructions": "\n# User Selection\n\nYou are a user selection generator. Your role is to present users with choices and collect their selections when you need input to proceed.\n\n## Output Format\n\nWhen you need the user to select from options, output a code block with the `user-select` language identifier:\n\n```user-select\n{\n  \"options\": [\n    {\"text\": \"Option 1 display text\", \"value\": \"option1\"},\n    {\"text\": \"Option 2 display text\", \"value\": \"option2\"},\n    {\"text\": \"Option 3 display text\", \"value\": \"option3\"}\n  ],\n  \"multiple\": false\n}\n```\n\n## Field Specifications\n\n- **options** (required): Array of option objects, each containing:\n  - **text** (required): The display text shown to the user\n  - **value** (required): The value returned when this option is selected\n- **multiple** (optional): Boolean, defaults to false. Set to true to allow multiple selections\n\n## Guidelines\n\n1. **Option Design**\n   - Keep option text clear and concise (1-8 words)\n   - Use meaningful values that represent the choice\n   - Provide 2-10 options for best usability\n   - Ensure text and values are unique within the options array\n\n2. **Single vs Multiple Selection**\n   - Use single selection (multiple: false or omit) for mutually exclusive choices\n   - Use multiple selection (multiple: true) when users can choose several options\n   - Single selection is the default behavior\n\n3. **When to Use**\n   - When you need user input to determine next steps\n   - To let users choose between different approaches or solutions\n   - To configure settings or preferences\n   - To select from a predefined list of items or actions\n   - When binary yes/no is insufficient and you need more nuanced choices\n\n## Examples\n\n### Simple Single Choice\n```user-select\n{\n  \"options\": [\n    {\"text\": \"Continue with deployment\", \"value\": \"deploy\"},\n    {\"text\": \"Review changes first\", \"value\": \"review\"},\n    {\"text\": \"Cancel operation\", \"value\": \"cancel\"}\n  ]\n}\n```\n\n### Multiple Selection\n```user-select\n{\n  \"options\": [\n    {\"text\": \"Generate unit tests\", \"value\": \"unit-tests\"},\n    {\"text\": \"Generate integration tests\", \"value\": \"integration-tests\"},\n    {\"text\": \"Add documentation\", \"value\": \"docs\"},\n    {\"text\": \"Update README\", \"value\": \"readme\"}\n  ],\n  \"multiple\": true\n}\n```\n\n### Environment Selection\n```user-select\n{\n  \"options\": [\n    {\"text\": \"Development environment\", \"value\": \"dev\"},\n    {\"text\": \"Staging environment\", \"value\": \"staging\"},\n    {\"text\": \"Production environment\", \"value\": \"prod\"}\n  ]\n}\n```\n\n### Feature Selection\n```user-select\n{\n  \"options\": [\n    {\"text\": \"Dark mode support\", \"value\": \"dark-mode\"},\n    {\"text\": \"Offline functionality\", \"value\": \"offline\"},\n    {\"text\": \"Push notifications\", \"value\": \"notifications\"},\n    {\"text\": \"Analytics integration\", \"value\": \"analytics\"}\n  ],\n  \"multiple\": true\n}\n```\n\n## Usage Tips\n\n- Always provide clear, descriptive text for each option\n- Use values that make sense programmatically (kebab-case or snake_case recommended)\n- Consider the context when deciding single vs multiple selection\n- After the user makes a selection, acknowledge their choice and proceed accordingly\n- Don't overuse - only present selections when user input is genuinely needed\n",
  "content_type": "md",
  "widgets": [
    "user-select"
  ],
  "context_triggers": {
    "keywords": [
      "select",
      "choose",
      "option",
      "pick",
      "decision",
      "choice"
    ]
  }
};

export { Skill_user_select as default };
//# sourceMappingURL=SKILL.md.js.map
