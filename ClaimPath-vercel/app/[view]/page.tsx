import {Suspense} from 'react';
import ClaimPath from '../workspace';
export default function Page(){return <Suspense fallback={<p>Loading ClaimPath…</p>}><ClaimPath/></Suspense>}
