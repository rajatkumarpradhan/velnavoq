export type PublicTable={name:string;fields:Record<string,'string'|'number'|'boolean'>};
export function recordValues(table:PublicTable,values:Record<string,string|boolean>):Record<string,string|number|boolean>{
 const row:Record<string,string|number|boolean>={};
 for(const [field,type] of Object.entries(table.fields)){
  const value=values[field];
  if(type==='boolean'){if(typeof value!=='boolean')throw Error('Enter true or false for '+field+'.');row[field]=value;}
  else if(type==='number'){if(typeof value!=='string'||!value.trim()||!Number.isFinite(Number(value)))throw Error('Enter a finite number for '+field+'.');row[field]=Number(value);}
  else {if(typeof value!=='string'||value.length>1000)throw Error('Enter text up to 1,000 characters for '+field+'.');row[field]=value;}
 }
 return row;
}
