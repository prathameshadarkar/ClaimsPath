import urllib.request,urllib.error,http.cookiejar,json
import os
base=os.environ.get('CLAIMPATH_TEST_URL','http://127.0.0.1:8787')
def client(): return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
c=client()
def req(path,data=None,op=c):
 r=op.open(urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'}));return json.load(r)
s=req('/api/workspace');assert len(s['claims'])==30
for route in ['/','/claims','/workspace','/documents','/evidence','/appeals','/review','/analytics','/project']:
 assert c.open(base+route).status==200
try:req('/api/workspace',{'action':'submit','claimId':'CP-1001'});raise AssertionError('Incomplete submitted')
except urllib.error.HTTPError as e:assert e.code==400
boundary='claimpath-test-boundary'
body=''.join('--'+boundary+'\r\nContent-Disposition: form-data; name="'+k+'"\r\n\r\n'+v+'\r\n' for k,v in {'claimId':'CP-1001','sample':'true','kind':'Referral'}.items())+'--'+boundary+'--\r\n'
s=json.load(c.open(urllib.request.Request(base+'/api/documents',data=body.encode(),headers={'Content-Type':'multipart/form-data; boundary='+boundary})));assert s['claims'][0]['status']=='Ready to draft'
s=req('/api/workspace',{'action':'draft','claimId':'CP-1001'});assert 'attached referral' in s['claims'][0]['draft']
s=req('/api/workspace',{'action':'submit','claimId':'CP-1001'});assert s['claims'][0]['status']=='In review'
s=req('/api/workspace',{'action':'approve','claimId':'CP-1001'});assert s['claims'][0]['status']=='Approved'
assert req('/api/workspace')['claims'][0]['status']=='Approved'
assert req('/api/workspace',op=client())['claims'][0]['status']=='Missing evidence'
s=req('/api/workspace',{'action':'saveDraft','claimId':'CP-1001','text':'Changed draft'});assert s['claims'][0]['status']=='Ready to draft'
r=req('/api/copilot',{'claimId':'CP-1001','question':'What changed?'});assert r['mode']=='Evidence assistant';assert 'now in the packet' in r['answer']
assert len(s['events'])>=6
print('PASS: nine routes; incomplete submission blocked; evidence changes readiness; draft → review → approval; reload persistence; session isolation; editing invalidates approval; copilot grounded in updated evidence.')
