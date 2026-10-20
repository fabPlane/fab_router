"""Strict S-expression parser retained from the prior deletion diagnostic."""
import re
def parse(s):
 """Read exactly one complete tree; reject ignored or ambiguous design bytes."""
 stack=[];root=None;offset=0
 tokens=re.compile(r'"(?:\\.|[^"\\])*"|[()]|[^\s()"]+')
 for match in tokens.finditer(s):
  if s[offset:match.start()].strip():raise ValueError('invalid S-expression token')
  offset=match.end();t=match.group()
  if t=='(':
   if not stack and root is not None:raise ValueError('multiple S-expression roots')
   n=[]
   if stack:stack[-1].append(n)
   stack.append(n)
  elif t==')':
   if not stack:raise ValueError('unmatched S-expression close')
   n=stack.pop()
   if not stack:root=n
  else:
   if not stack:raise ValueError('atom outside S-expression root')
   stack[-1].append(t)
 if s[offset:].strip() or stack or root is None:raise ValueError('incomplete S-expression')
 return root
def dump(n):return '('+' '.join(map(dump,n))+')' if isinstance(n,list) else n
