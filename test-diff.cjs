const { JSDOM } = require('jsdom');

function groupHtmlDiff(html) {
  if (!html) return html;
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const Node = dom.window.Node;

    function processNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        let children = Array.from(node.childNodes);
        let i = 0;
        
        while (i < children.length) {
          let child = children[i];
          
          let run = [];
          let j = i;
          let hasDel = false;
          let hasIns = false;
          
          while (j < children.length) {
            let next = children[j];
            if (next.nodeType === Node.ELEMENT_NODE && next.tagName === 'DEL') {
              run.push(next);
              hasDel = true;
            } else if (next.nodeType === Node.ELEMENT_NODE && next.tagName === 'INS') {
              run.push(next);
              hasIns = true;
            } else if (next.nodeType === Node.TEXT_NODE && /^\s+$/.test(next.textContent || '')) {
              run.push(next);
            } else {
              break;
            }
            j++;
          }
          
          const mutCount = run.filter(n => n.nodeType === Node.ELEMENT_NODE).length;
          if (mutCount > 1) {
            let delContent = [];
            let insContent = [];
            
            run.forEach(n => {
              if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'DEL') {
                delContent.push(n.innerHTML);
              } else if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'INS') {
                insContent.push(n.innerHTML);
              } else if (n.nodeType === Node.TEXT_NODE) {
                if (hasDel) delContent.push(n.textContent || '');
                if (hasIns) insContent.push(n.textContent || '');
              }
            });
            
            const runStart = run[0];
            let newNodes = [];
            
            if (hasDel) {
              let newDel = document.createElement('del');
              newDel.className = 'diffmod';
              newDel.innerHTML = delContent.join('').replace(/\s+$/, '') + (hasDel && hasIns ? '' : ' ');
              newNodes.push(newDel);
            }
            if (hasDel && hasIns) {
              newNodes.push(document.createTextNode(' '));
            }
            if (hasIns) {
              let newIns = document.createElement('ins');
              newIns.className = 'diffmod';
              newIns.innerHTML = insContent.join('').replace(/^\s+/, '');
              newNodes.push(newIns);
            }
            
            newNodes.forEach(n => node.insertBefore(n, runStart));
            run.forEach(n => node.removeChild(n));
            
            children = Array.from(node.childNodes);
            i += newNodes.length;
          } else {
            processNode(child);
            i++;
          }
        }
      }
    }
    
    processNode(document.body);
    return document.body.innerHTML;
  } catch (e) {
    return html;
  }
}

const input = '<p><del class="diffmod">Botanic</del><ins class="diffmod">Edifício</ins> <del class="diffmod">View</del><ins class="diffmod">Rivage</ins></p>';
console.log(groupHtmlDiff(input));
