let prepared:{popup:Window;nonce:string;host:string}|null=null;
export function preparePreviewWindow(host:string){if(!host)return;const nonce=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');const popup=window.open(host+'#'+nonce,'velnavoq-preview-'+nonce);if(popup)prepared={popup,nonce,host}}
export function takePreviewWindow(host:string){const p=prepared;prepared=null;if(p?.host===host&&!p.popup.closed)return p;return null}
