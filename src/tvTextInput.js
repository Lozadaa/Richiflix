// Samsung IME Done/Cancel are distinct from remote OK/Return.
export function textInputAction(event){
 if(event.isComposing||event.keyCode===229)return null;
 if(event.keyCode===65376||event.key==='Accept')return 'done';
 if(event.keyCode===65385||event.key==='Cancel'||event.keyCode===10009||event.key==='Escape')return 'leave';
 return null;
}
export function isTextField(element){
 return element?.tagName==='TEXTAREA'||element?.tagName==='INPUT'&&['text','search','url','email','password','tel','number'].includes(element.type);
}
export function inputReturnHint(field){return field.dataset.tvSearch?'search':field.form&&[...field.form.elements].some(element=>isTextField(element)&&!element.disabled&&element!==field&&element.compareDocumentPosition(field)&2)?'next':'done';}
export function nextInputControl(field){
 const form=field.form;
 if(form){const controls=[...form.elements].filter(element=>!element.disabled&&!element.closest('[inert]'));
  const next=controls.slice(controls.indexOf(field)+1).find(isTextField);if(next)return next;
  return form.querySelector('button[type="submit"]:not(:disabled),button.primary:not(:disabled),button:not([type]):not(:disabled)')||controls.find(element=>element.tagName==='BUTTON');
 }
 const dialog=field.closest('[role="dialog"]');
 return dialog?.querySelector('button:not(:disabled)')||document.querySelector('.topbar nav button.active,.profile-grid button');
}
