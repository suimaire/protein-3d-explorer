import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Development-only audit: extract the deposited mmCIF sequence-number mapping, never infer an array offset.
const structures=[];
for(const id of ['1BTL','1JWP']){
 const bytes=await readFile(`src/data/structures/${id}.pdb`),pdb=bytes.toString(),cif=await readFile(`artifacts/${id}.cif`,'utf8');
 const lines=cif.split(/\r?\n/).map(l=>l.trim()),start=lines.findIndex(l=>l==='_pdbx_poly_seq_scheme.asym_id');
 if(start<0)throw new Error(id+': missing sequence mapping');
 const columns=[];let i=start;while(lines[i]?.startsWith('_pdbx_poly_seq_scheme.'))columns.push(lines[i++].split('.')[1]);
 const mapping=[];while(lines[i]&&!lines[i].startsWith('#')){const row=lines[i++].trim().split(/\s+/);mapping.push(Object.fromEntries(columns.map((k,j)=>[k,row[j]])));}
 if(mapping.length!==263)throw new Error(id+': unexpected mapping length');
 const atoms=pdb.split(/\r?\n/).filter(l=>l.startsWith('ATOM  '));
 const alt=atoms.filter(l=>l[16]!==' ');
 const source={id,source:`https://files.rcsb.org/download/${id}.pdb`,mappingSource:`https://files.rcsb.org/download/${id}.cif`,acquired:'2026-09-29',sha256:createHash('sha256').update(bytes).digest('hex'),method:pdb.match(/^EXPDTA\s+(.+)$/m)?.[1].trim(),resolution:Number(pdb.match(/RESOLUTION\.\s+([\d.]+) ANGSTROMS/)?.[1]),chain:'A',mapping,alternateAtomRecords:alt.length,alternateResidues:[...new Set(alt.map(l=>l.slice(17,27).trim()))],sequenceDifferences:pdb.split(/\r?\n/).filter(l=>l.startsWith('SEQADV'))};
 structures.push(source);
 console.log(id,JSON.stringify({...source,mapping:undefined}),mapping.filter(r=>['36','70','182'].includes(r.pdb_seq_num)));
}
await writeFile('tests/fixtures/tem1-rcsb-metadata.json',JSON.stringify({structures},null,2)+'\n');
