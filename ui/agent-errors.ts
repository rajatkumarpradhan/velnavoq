const messages:Record<string,string>={
agent_path_denied:'The AI used an unsupported file name. Only HTML, CSS, JavaScript, JSON, SVG and text files are supported. No changes were saved. Try asking for a static frontend.',
agent_instructions_denied:'Use a short app request without passwords or API keys.',
agent_project_token_budget_required:'This project needs more AI tokens. Open Usage and increase its token budget within the free limits.',
agent_provider_not_connected:'AI is unavailable right now. Your project is unchanged.',
agent_invalid_model_json:'The AI reply was incomplete or not valid code changes. No changes were saved. Try a smaller request.',
agent_change_limit:'The AI tried to change too much at once. Ask for one page or feature first.',
agent_content_denied:'The AI returned a file that is too large or contains a possible secret. No changes were saved.',
agent_previous_digest_mismatch:'A file changed while the AI was working. Refresh and try again.',
agent_whole_repository_rewrite:'The AI tried to replace every existing file. Ask it to update only the files needed.',
agent_invalid_change:'The AI returned an invalid change. Nothing was saved. Try a smaller request.',
agent_create_conflict:'The AI tried to create a file that already exists. Ask it to update that file instead.',
agent_noop:'The AI did not change the source. Try a more specific request.',
agent_duplicate_path:'The AI returned duplicate changes for one file. Nothing was saved.',
agent_secret_file_denied:'This file may contain a secret and cannot be changed by the AI.',
agent_destructive_requires_high_risk:'The AI did not mark a delete or rename for review. Nothing was saved.',
agent_rename_conflict:'The rename destination already exists. Nothing was saved.',
agent_steps_exhausted:'The AI could not produce valid changes in the allowed attempts. Try a smaller request.',
agent_timeout:'AI took too long. No changes were saved. Try again with a smaller request.',
agent_cancelled:'Generation was stopped. No changes were saved.',
stale_agent_snapshot:'Your project changed while the AI was working. Refresh and try again.'
};
export function agentError(code:string):string{if(messages[code])return messages[code]!;if(code.startsWith('agent_ai_'))return code.includes('rate')?'The free AI limit has been reached. Try again later. Your source is unchanged.':'AI could not finish this request. Your source is unchanged. Try a smaller request.';if(code.startsWith('agent_'))return 'The AI could not safely finish these changes. No changes were saved. Try one page or feature at a time.';return code==='generation_unavailable'?'Generation is unavailable. Try again later.':code.replaceAll('_',' ');}
