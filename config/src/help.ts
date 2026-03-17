export function initHelp(): void {
  const contactTpl = document.getElementById('contact-section') as HTMLTemplateElement;
  const helpPanel = document.getElementById('panel-help')!;
  const contactHtml = contactTpl.innerHTML;
  if (/mailto:[^"]+/.test(contactHtml)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = contactHtml;
    const divider = tmp.querySelector('.divider');
    const contact = tmp.querySelector('.contact');
    if (divider) helpPanel.appendChild(divider);
    if (contact) helpPanel.appendChild(contact);
  }
}
