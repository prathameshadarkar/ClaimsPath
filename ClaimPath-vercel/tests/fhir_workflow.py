import json,urllib.request,urllib.error,http.cookiejar
import os
base=os.environ.get('CLAIMPATH_TEST_URL','http://127.0.0.1:3000')
c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def req(path,data=None):
 try:
  r=c.open(urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'}),timeout=90)
  return json.load(r)
 except urllib.error.HTTPError as e:raise AssertionError(str(e.code)+' '+e.read().decode())
initial=req('/api/workspace');patients=req('/api/fhir')['patients'];assert len(patients)==3
previews=[]
for p in patients:
 v=req('/api/fhir?patient='+p['id']);assert v['patient']['id']==p['id'];assert v['encounters'];previews.append(v)
v=previews[0];eid=v['encounters'][0]['id'];payload={'patientId':v['patient']['id'],'encounterId':eid}
r=req('/api/fhir',payload);s=r['state'];claim=next(c for c in s['claims'] if c['id']==r['claimId']);assert len(s['claims'])==31;assert s['claims'][0]==initial['claims'][0];assert claim['status']=='Missing evidence';assert claim['date']==v['encounters'][0]['period']['start'][:10];assert claim['fhir']['patientId']==v['patient']['id'];assert req('/api/fhir',payload)['existing'];assert len(req('/api/workspace')['claims'])==31
bundle=json.loads(next(d['text'] for d in s['docs'] if d['id']==claim['fhir']['documentId']));assert bundle['resourceType']=='Bundle';assert bundle['entry'][0]['resource']['resourceType']=='Patient'
for route,body in [('/api/fhir?patient=not-allowlisted',None),('/api/fhir',{'patientId':v['patient']['id'],'encounterId':'not-this-patient'}),('/api/workspace',{'claimId':claim['id'],'action':'submit'})]:
 try:req(route,body)
 except AssertionError:pass
 else:raise AssertionError('Invalid input accepted')
answer=req('/api/copilot',{'claimId':claim['id'],'question':'Where does this case come from?'})['answer'];assert 'FHIR source' in answer and 'fictional scenario fields' in answer
print('PASS: three live Synthea patients, live encounter resources, import and persistence, source Bundle, source dates, idempotency, existing-case preservation, blocked non-allowlisted/mismatched imports, incomplete-evidence guard and copilot provenance.')
