// LC5 moisture physics extracted from LayerCraft 5/risk_functions.js for LC6 S21 physics fidelity audit. Do not edit — reference only.
//
// Source: /Users/cmcarter/Desktop/LayerCraft 5/risk_functions.js (6201 lines total)
// Primary function: calcIntermittentMoisture (risk_functions.js:2426-3393, 968 lines)
// Sibling: calcSteadyStateMoisture (risk_functions.js:3403-3600)
//
// Extracted line ranges (from source file):
//   1-18     file header + constants
//   20-32    computeTissueCLO, computeTSkin
//   44-191   respiratory/metabolic heat, iterativeTSkin, convective/radiative heat loss,
//            epocParams, epocTau, estimateCoreTemp, civdProtectionFactor, computeHLR, shiveringBoost
//   199-358  gear/layer helpers (getFiberType, getLayerCapacity, breathabilityToIm,
//            buildLayerArray, computePerceivedMR, computeEmax, computeSweatRate)
//   815-863  bodyTempInc, clothingInsulation, applySaturationCascade
//   865-1086 calcEnsembleIm, waderSplitIm, waderSplitCLO, snowSportSplitIm
//   1438-1666 descentSpeedWind, hasPhaseAsymmetry, calcBCPhasePercentages, calcMultiLapMoisture
//   1700-1714 breakResetFactor
//   1810-1996 sweatRate, getEffectiveIntensity, paceSweatMultiplier, getWindPenetration, getEnsembleCapacity
//   1998-2098 satVaporPressure, vpdRatio, humidityFloorFactor, waderEvapFloor,
//             precipWettingRate, getDrainRate, hygroAbsorption, applyDurationPenalty
//   2379-2424 warmthToCLO, pumpingReduction, windCLOProtection, staticLayeringCorrection, computeEffectiveCLO
//   2426-3393 calcIntermittentMoisture (MAIN)
//   3403-3600 calcSteadyStateMoisture (sibling — continuous activities)
//   3882-3993 activityCLO
//
// =====================================================================

// ===== risk_functions.js lines 1-18 =====

// ============================================================
// LC5 ENERGY BALANCE CONSTANTS
// Sources: Gagge 1972, Ainsworth 2011, ASHRAE Fundamentals
// ============================================================
var LC5_L_V=2430;           // J/g, latent heat of vaporization
var LC5_C_P_AIR=1.005;      // J/(g·°C), specific heat of air
var LC5_RHO_AIR=1.225;      // g/L, density of air at sea level
var LC5_RHO_VAP_EXP=44.0;   // g/m³, expired air vapor density (saturated at 37°C)
var LC5_SIGMA=5.67e-8;      // W/(m²·K⁴), Stefan-Boltzmann
var LC5_EMISS=0.95;         // clothing surface emissivity
var LC5_T_CORE_BASE=37.0;   // °C, baseline core temperature
var LC5_BODY_SPEC_HEAT=3490; // J/(kg·°C), body specific heat (Gagge 1972)

// ============================================================
// LC5 ENERGY BALANCE FUNCTIONS (Sections 2–13)
// ============================================================


// ===== risk_functions.js lines 20-32 =====
function computeTissueCLO(bodyFatPct){
  return Math.min(0.9,Math.max(0.15,0.1+(bodyFatPct/100)*2.0));
}

// Section 3: Steady-state skin temperature from heat balance
// Cardinal Rule #7: T_skin COMPUTED, never constant
function computeTSkin(TcoreC,TambC,Rtissue,Rclo,Rair){
  var Rout=Rclo+Rair;
  var denom=Rtissue+Rout;
  if(denom<=0)return 33.0;
  return(TcoreC*Rout+TambC*Rtissue)/denom;
}


// ===== risk_functions.js lines 44-191 =====
function computeRespiratoryHeatLoss(MET,TambC,RH,bodyMassKg,faceCover){
  var coverFactor=faceCover==='balaclava'?0.65:faceCover==='hme'?0.50:1.0;
  var VE=computeVE(MET,bodyMassKg);
  // Sensible: warming air from ambient to 37°C
  var Qsens=VE*LC5_RHO_AIR*LC5_C_P_AIR*(37-TambC)/60;
  // Latent: humidifying air — Magnus formula for vapor density
  var esat=6.1078*Math.exp((17.27*Math.max(-45,TambC))/(Math.max(-45,TambC)+237.3));
  var eActual=esat*100*RH; // Pa
  var rhoAmb=Math.max(0,(eActual/(461.5*(TambC+273.15)))*1000); // g/m³
  var moistureGmin=VE*(LC5_RHO_VAP_EXP-rhoAmb)/1000; // g/min
  var Qlat=moistureGmin*LC5_L_V/60; // W
  return{
    total:Math.max(0,(Qsens+Qlat)*coverFactor),
    moistureGhr:Math.max(0,moistureGmin*60*coverFactor)
  };
}

// Section 6: Metabolic heat production (Ainsworth 2011)
function computeMetabolicHeat(MET,bodyMassKg){
  // 1 MET = 1.163 W/kg. Mechanical efficiency ~17%.
  return MET*1.163*bodyMassKg*0.83;
}

// PHY-056: Iterative Gagge two-node T_skin solve
// Replaces single-pass computeTSkin for the energy balance hot path.
// Iterates until T_skin converges (vasodilation + evap cooling feedbacks).
function iterativeTSkin(Tcore, TambC, Rtissue, RcloInit, Rair, BSA, MET, windMs, RH, imEnsemble, bodyFatPct, maxIter, tol) {
  maxIter = maxIter || 8;
  tol = tol || 0.1;
  var M = MET * 58.2 * BSA;
  var W = M * 0.10;
  var Tskin = computeTSkin(Tcore, TambC, Rtissue, RcloInit, Rair);
  var hTissueBase = 5.28;
  var hTissue = hTissueBase;
  var Ereq = 0, Eact = 0, vdil = 0;
  for (var iter = 0; iter < maxIter; iter++) {
    var TskinPrev = Tskin;
    var hc = 8.3 * Math.sqrt(Math.max(0.5, windMs));
    var RairCalc = 1 / hc;
    var Tcl = Tskin - (Tskin - TambC) * (RcloInit / (RcloInit + RairCalc));
    var Qconv = BSA * hc * (Tcl - TambC);
    var Qrad = BSA * 4.7 * (Tcl - TambC);
    var Eresp = 0.017 * M * (5.87 - (RH / 100) * 0.611 * Math.exp(17.27 * TambC / (TambC + 237.3))) + 0.0014 * M * (34 - TambC);
    Ereq = Math.max(0, (M - W) - Qconv - Qrad - Eresp);
    var pSkin = 0.611 * Math.exp(17.27 * Tskin / (Tskin + 237.3));
    var pAmb = (RH / 100) * 0.611 * Math.exp(17.27 * TambC / (TambC + 237.3));
    var he = 16.5 * hc;
    var fcl = 1.0 + 0.31 * (RcloInit / 0.155);
    // ISO 7933 resistance form (consistent with computeEmax)
    var _itIcl = RcloInit; // already in m²·K/W
    var _itRecl = (imEnsemble > 0) ? _itIcl / ((imEnsemble || 0.089) * 16.5 * fcl) : 9999;
    var _itRea = 1 / (fcl * he);
    var Emax = Math.max(1, (pSkin - pAmb) * BSA / (_itRecl + _itRea));
    Eact = Math.min(Ereq, Emax);
    var thermalLoad = (M - W) - Qconv - Qrad - Eresp;
    vdil = thermalLoad > 0 ? Math.min(45.0, thermalLoad / (BSA * 6)) : 0;
    var vcon = Tskin < 33 ? Math.min(3.0, (33 - Tskin) * 0.5) : 0;
    hTissue = hTissueBase + vdil - vcon;
    Tskin = Tcore - ((M - W) - Eresp - Eact) / (hTissue * BSA);
    Tskin = Math.max(25, Math.min(37, Tskin));
    if (Math.abs(Tskin - TskinPrev) < tol) {
      return {T_skin:Tskin, converged:true, iterations:iter+1, h_tissue:hTissue, E_req:Ereq, E_actual:Eact, vasodilation:vdil};
    }
  }
  return {T_skin:Tskin, converged:false, iterations:maxIter, h_tissue:hTissue, E_req:Ereq, E_actual:Eact, vasodilation:vdil};
}

// Section 7: Convective heat loss
function computeConvectiveHeatLoss(TskinC,TambC,Rclo,BSA,windMs,speedWindMs){
  var effWind=windMs+(speedWindMs||0);
  var hc=8.3*Math.sqrt(Math.max(0.5,effWind));
  var Rair=1/hc;
  var Rtotal=Rclo+Rair;
  if(Rtotal<=0)return 0;
  return(TskinC-TambC)/Rtotal*BSA;
}

// Section 8: Radiative heat loss (Stefan-Boltzmann)
function computeRadiativeHeatLoss(TsurfC,TambC,BSA){
  var TsK=TsurfC+273.15;
  var TaK=TambC+273.15;
  return LC5_EMISS*LC5_SIGMA*BSA*(Math.pow(TsK,4)-Math.pow(TaK,4));
}

// Section 9: EPOC two-component model (Børsheim & Bahr 2003, Sports Med 33(14))
// Returns {tauFast, tauSlow, aFast, aSlow} for MET(t) = MET_rest + aFast*exp(-t/tauFast) + aSlow*exp(-t/tauSlow)
function epocParams(METrun,METrest){
  var dMET=METrun-(METrest||1.5);
  // Intensity-dependent split: higher intensity → more slow component
  var fastFrac=METrun<=6?0.70:0.60; // Børsheim Table 2
  var tauFast=METrun<=6?3:5; // minutes
  var tauSlow=METrun<=6?30:45; // minutes
  return {tauFast:tauFast,tauSlow:tauSlow,aFast:dMET*fastFrac,aSlow:dMET*(1-fastFrac)};
}
// Legacy single-tau wrapper (backward compat for CLO floor etc.)
function epocTau(METrun){
  if(METrun<=3)return 4;
  if(METrun<=6)return 4+(METrun-3)*2;
  return 10+(METrun-6)*3.3;
}

// Section 10: Core temperature from cumulative heat storage (Gagge 1972)
function estimateCoreTemp(baseCoreC,cumStorageWmin,bodyMassKg){
  var energyJ=cumStorageWmin*60;
  var deltaT=energyJ/(bodyMassKg*LC5_BODY_SPEC_HEAT);
  return Math.max(34.0,Math.min(39.5,baseCoreC+deltaT));
}

// Section 11: CIVD protection factor (Flouris & Cheung 2008)
function civdProtectionFactor(coreTempC){
  // 0.0 = fully protected (CIVD active), 1.0 = abandoned (CIVD absent)
  if(coreTempC>=37.5)return 0.0;
  if(coreTempC>=37.0)return(37.5-coreTempC)/0.5*0.3;
  if(coreTempC>=36.5)return 0.3+(37.0-coreTempC)/0.5*0.4;
  if(coreTempC>=36.0)return 0.7+(36.5-coreTempC)/0.5*0.3;
  return 1.0;
}

// Section 12: HLR from energy deficit + core temp status
function computeHLR(deficitW,coreTempC,TambC,satFrac){
  var base;
  if(deficitW<0){
    base=1.5+Math.abs(deficitW)/60;
  }else{
    base=Math.max(0.5,2.0-deficitW/100);
  }
  var civdDanger=civdProtectionFactor(coreTempC);
  var coreAmp=1.0+civdDanger; // 1.0→2.0
  var coldSev;
  if(TambC<-10)coldSev=1.3;
  else if(TambC<0)coldSev=1.0+(-TambC)/50;
  else if(TambC<5)coldSev=1.0;
  else coldSev=Math.max(0.8,1.0-(TambC-5)/50);
  var wetness=1.0+satFrac*0.5;
  return Math.min(10,base*coreAmp*coldSev*wetness);
}

// Section 13: Shivering thermogenesis (Young et al. 1986)
function shiveringBoost(TambC,METcurrent,CLOtotal,bodyFatPct){
  var coldStress=Math.max(0,(10-TambC)/30);
  var protection=CLOtotal*0.3+(bodyFatPct/100)*0.5;
  var net=Math.max(0,coldStress-protection);
  var crossover=2+net*4;
  if(METcurrent>=crossover)return 0;
  return Math.max(0,Math.min(2.5,
    (crossover-METcurrent)/crossover*2.5*net));
}


// ===== risk_functions.js lines 199-358 =====
function getFiberType(item){
  // Level 1: explicit material field
  if(item&&item.material){
    if(/merino|wool/i.test(item.material))return 'WOOL';
    if(/cotton|denim/i.test(item.material))return 'COTTON';
    if(/down/i.test(item.material))return 'DOWN';
    return 'SYNTHETIC';
  }
  // Level 2: keyword scan on brand + model + name
  var hay=((item&&item.brand||'')+(item&&item.model||'')+(item&&item.name||'')).toLowerCase();
  if(/merino|wool|smartwool|icebreaker/.test(hay))return 'WOOL';
  if(/cotton|denim|canvas|flannel/.test(hay))return 'COTTON';
  if(/down|puffy|800.?fill|700.?fill/.test(hay))return 'DOWN';
  // Level 3: default
  return 'SYNTHETIC';
}

// Absorption coefficients — ASTM D1909 moisture regain values
// Fabric liquid retention coefficients (fraction of garment weight retained as moisture)
// WOOL: 0.30 — ASTM D1909, merino regain 13-16% at 65%RH, up to 33% at saturation
// COTTON: 0.15 — ASTM D1909, cotton regain 7-8.5%, lateral wicking spreads to ~15%
// SYNTHETIC: 0.06 — ISO 9073-6 methodology; Yoo & Kim 2008 Fig 11: 16g/m² ÷ 246g/m² = 0.065
// DOWN: 0.12 — cluster absorption, loses ~50% loft when wet
var FIBER_ABSORPTION={WOOL:0.30,COTTON:0.15,SYNTHETIC:0.06,DOWN:0.12};

// Per-layer capacity in mL from garment weight and fiber absorption
function getLayerCapacity(item,fiberType){
  var absorption=FIBER_ABSORPTION[fiberType]||0.02;
  // Estimate garment weight from warmth score if weightG not available
  var weightG=(item&&item.weightG)||(100+((item&&(item.warmthRatio||item.warmth))||5)*20);
  return Math.max(2,weightG*absorption);
}

// Breathability → per-layer im mapping (1-10 scale → Woodcock index)
// Soft mapping: B=10 → im=0.45 (mesh), B=7 → im=0.20 (standard), B=4 → im=0.08 (sealed)
function breathabilityToIm(breathScore){
  if(!breathScore||breathScore<=0)return 0.08;
  if(breathScore>=10)return 0.45;
  // Piecewise: 1-4 → 0.05-0.08, 5-7 → 0.10-0.20, 8-10 → 0.25-0.45
  if(breathScore<=4)return 0.05+breathScore*0.0075;
  if(breathScore<=7)return 0.05+(breathScore-4)*0.05;
  return 0.20+(breathScore-7)*0.083;
}

// Build layer array from gear items for the per-layer buffer model
// gearItems: array of gear product objects from user's kit (base→mid→insulation→shell order)
// Returns: [{im, cap, buffer, wicking, fiber, name}]
// When no gear entered, returns a default 3-layer stack matching activityCLO
function buildLayerArray(gearItems,activity,totalCLO,isStrategyPill){
  if(gearItems&&gearItems.length>0){
    return gearItems.map(function(item){
      var fiber=getFiberType(item);
      return {
        im:breathabilityToIm(item.breathability),
        cap:getLayerCapacity(item,fiber),
        buffer:0,
        wicking:item.moisture||item.moistureWicking||7,
        fiber:fiber,
        name:(item.brand||'')+' '+(item.model||item.name||'')
      };
    });
  }
  // Default layer stack — differs by pill type
  var clo=totalCLO||activityCLO(activity||'skiing');
  var nLayers=clo>=2.0?4:3; // minimum 3 layers (base+mid+shell) — softshell rider still has 3
  var defaults=[];
  if(isStrategyPill){
    // Strategy recommendation: synthetic base, high wicking (optimizer selects breathable kit)
    defaults.push({im:0.35,cap:getLayerCapacity({warmth:5},'SYNTHETIC'),buffer:0,wicking:10,fiber:'SYNTHETIC',name:'Optimized Synthetic Base'});
  }else{
    // User default: typical retail merino base (WOOL absorption ~60mL, moderate wicking)
    defaults.push({im:0.25,cap:getLayerCapacity({warmth:5},'WOOL'),buffer:0,wicking:6,fiber:'WOOL',name:'Typical Merino Base'});
  }
  if(nLayers>=3){
    // Mid layer: fleece — warmth ~5 (moderate fleece)
    defaults.push({im:0.30,cap:getLayerCapacity({warmth:5},'SYNTHETIC'),buffer:0,wicking:8,fiber:'SYNTHETIC',name:'Default Mid'});
  }
  if(nLayers>=4){
    // Insulation — warmth ~7 (moderate puffy/synthetic fill)
    defaults.push({im:0.15,cap:getLayerCapacity({warmth:7},'SYNTHETIC'),buffer:0,wicking:6,fiber:'SYNTHETIC',name:'Default Insulation'});
  }
  // Shell: always present — warmth ~2 (shell provides wind/water, minimal warmth)
  defaults.push({im:0.12,cap:getLayerCapacity({warmth:2},'SYNTHETIC'),buffer:0,wicking:4,fiber:'SYNTHETIC',name:'Default Shell'});
  return defaults;
}

// Perceived MR weights — skin-adjacent layers matter most
// Source: Fukazawa 2003, Zhang 2002 — skin wetness perception correlates with skin-fabric interface
var PERCEIVED_WEIGHTS=[3,2,1.5,1]; // base, mid, insulation, shell

// Comfort threshold for base layer — Fukazawa 2003: skin wetness perception onset ~50 g/m²
// Torso base layer contact area ~0.8 m² → threshold ~40 mL
var COMFORT_THRESHOLD=40; // mL — onset of "damp" sensation

function computePerceivedMR(layers){
  if(!layers||layers.length===0)return 0;
  // Base layer (i=0): absolute moisture vs comfort threshold, not fill fraction
  // User feels moisture against skin regardless of how much the fabric CAN hold
  var baseSat=Math.min(1,layers[0].buffer/COMFORT_THRESHOLD);
  var num=PERCEIVED_WEIGHTS[0]*baseSat;
  var den=PERCEIVED_WEIGHTS[0];
  // Other layers: fill fraction (user doesn't feel these directly)
  for(var i=1;i<layers.length;i++){
    var w=PERCEIVED_WEIGHTS[Math.min(i,PERCEIVED_WEIGHTS.length-1)];
    var fill=layers[i].cap>0?Math.min(1,layers[i].buffer/layers[i].cap):0;
    num+=w*fill;
    den+=w;
  }
  if(den<=0)return 0;
  return Math.min(10,7.2*(num/den));
}

// PHY-046: Maximum evaporative cooling capacity (Gagge 1986, ISO 7933)
// E_max = VPD × im × h_e × f_cl × BSA — the environment's ability to evaporate sweat
function computeEmax(tSkinC,tAmbC,rh,vAir,imEnsemble,clo,bsa){
  // Vapor pressures (Magnus formula, hPa)
  var pSkin=6.1078*Math.exp(17.27*tSkinC/(tSkinC+237.3));
  var tAmbClamped=Math.max(-45,tAmbC);
  var pAmb=(rh/100)*6.1078*Math.exp(17.27*tAmbClamped/(tAmbClamped+237.3));
  var vpdKpa=(pSkin-pAmb)/10; // hPa to kPa
  // Convective & evaporative coefficients
  var hc=8.3*Math.sqrt(Math.max(vAir,0.5)); // ISO 7730 forced convection
  var he=16.5*hc; // Lewis relation (Gagge & Gonzalez 1996)
  var fcl=1.0+0.31*clo; // clothing area factor (McCullough & Jones 1984)
  // E_max — ISO 7933:2023 §6.1.10 (Predicted Heat Strain model)
  // Total evaporative resistance = clothing resistance + boundary layer resistance
  // R_e,cl = I_cl / (im × LR × f_cl) — clothing as vapor barrier (Havenith 2000)
  // R_e,a = 1 / (f_cl × h_e) — boundary layer (air film)
  // E_max = VPD × BSA / R_e,t — maximum evaporative heat loss (watts)
  var Icl=clo*0.155; // clothing thermal resistance (m²·K/W) — ISO 9920
  var Recl=(imEnsemble>0)?Icl/(imEnsemble*16.5*fcl):9999; // clothing evaporative resistance (m²·kPa/W)
  var Rea=1/(fcl*he); // boundary layer evaporative resistance (m²·kPa/W)
  var Ret=Recl+Rea; // total evaporative resistance
  var eMax=Math.max(0,vpdKpa*bsa/Ret);
  return {eMax:eMax,Recl:Recl,Rea:Rea,Ret:Ret,pSkin:pSkin,pAmb:pAmb,vpdKpa:vpdKpa,hc:hc,he:he,fcl:fcl};
}

// PHY-046: Coupled sweat rate from Gagge two-node model (ISO 7933 §5.6)
// w_req = E_req/E_max determines regime: compensable vs uncompensable
function computeSweatRate(eReq,eMax){
  if(eReq<=0){
    return {sweatGPerHr:0,evapGPerHr:0,accumGPerHr:0,wReq:0,qEvapW:0,regime:'cold'};
  }
  var wReq=eMax>0?eReq/eMax:999;
  if(wReq<=1.0){
    // Compensable: environment handles the load. Most sweat evaporates.
    var sweat=(eReq/LC5_L_V)*3600; // g/hr
    return {sweatGPerHr:sweat,evapGPerHr:sweat,accumGPerHr:0,
      wReq:wReq,qEvapW:eReq,regime:'compensable'};
  } else {
    // Uncompensable: excess accumulates as trapped moisture
    var sweatU=(eReq/LC5_L_V)*3600;
    var evapU=(eMax/LC5_L_V)*3600;
    return {sweatGPerHr:sweatU,evapGPerHr:evapU,accumGPerHr:sweatU-evapU,
      wReq:wReq,qEvapW:eMax,regime:'uncompensable'};
  }
}

// Section 14: CLO floor — minimum CLO to prevent core cooling below 36.5°C
// Binary gate: if strategy winner's CLO causes hypothermia on the lift,

// ===== risk_functions.js lines 815-863 =====
function bodyTempInc(act,min,sex,weightLb){const r={low:0.3,moderate:0.6,high:1.0,very_high:1.4};const a=ACTIVITIES.find(x=>x.id===act);const base=Math.min((r[a?.intensity||"moderate"])*(min/15),15);const wt=weightLb||150;const wtMul=0.7+(wt/170)*0.3;const sexMul=(sex==="female")?0.85:1.0;return base*wtMul*sexMul}
function clothingInsulation(tempF, intensity){
  let clo;
  if(tempF>75) clo=0.3;       // minimal: single light layer
  else if(tempF>65) clo=0.5;  // light: base layer + maybe wind shirt
  else if(tempF>55) clo=0.7;  // moderate: base + light mid
  else if(tempF>45) clo=1.0;  // cool: base + mid layer
  else if(tempF>35) clo=1.4;  // cold: base + mid + light insulation
  else if(tempF>25) clo=1.8;  // very cold: base + mid + insulation + shell
  else if(tempF>10) clo=2.2;  // severe: full winter system
  else clo=2.5;                // extreme: maximum layering, vapor barrier
  const intMul={low:0.05, moderate:0.2, high:0.45, very_high:0.65}[intensity]||0.2;
  const excessClo=Math.max(0, clo-0.5);
  const heatTrapping=excessClo * intMul;
  return 1.0 + Math.min(heatTrapping, 1.0);
}
// Humidity floor — when evaporative pathway collapses, even low sweat = trapped moisture
// Applied AFTER base moisture risk calculation, BEFORE break factor
// Saturation Cascade v3: linear to 6, quadratic ease-out 6–10
// Phase 1 (0-6): Absorption + Crossover — linear, air pockets still mostly intact, k < 0.15 W/m·K
// Phase 2 (6-10): Saturation Cascade — quadratic ease-out, remaining air pockets collapse with
//   accelerating speed. Worst damage near full saturation. Castellani & Young (2016): wet k → 0.6 W/m·K
// v3 change: old curve (3-zone: linear 0-4, quad 4-6, exp 6+) was too aggressive — raw 7 mapped to 9.1
//   New curve: raw 7 → 7.8, preserving gear differentiation in the cascade zone
function applySaturationCascade(rawMR) {
  if (rawMR <= 6.0) return rawMR;           // Linear through Absorption + Crossover
  if (rawMR >= 10.0) return 10.0;           // Fully saturated — cap at max
  const ex = rawMR - 6.0;                   // 0 to 4 range
  const frac = ex / 4.0;                    // 0 to 1 normalized
  return 6.0 + 4.0 * (1 - Math.pow(1 - frac, 2));  // Quadratic ease-out
}

// Ensemble serial resistance model — layers act as resistors in series for vapor transport
// Harmonic mean of Woodcock im values: weakest link dominates
// im values per Woodcock spec Section 4.1. 'good' = standard/generic gear (B:3, W:2, Wind:2).
// Insulative layer tracked here but excluded from calcEnsembleIm harmonic mean (CLO only, not vapor transfer).
// PHY-025R: "typical" tier = honest baseline for users without gear input.
// Represents insulated ski jacket + basic fleece + cotton/basic synthetic base.
// See PHY-025R spec Section 4 for derivation. Values validated against gear DB.
const ENSEMBLE_IM_MAP = {
  base:       { typical: 0.25, good: 0.30, better: 0.50, best: 0.65 },
  mid:        { typical: 0.22, good: 0.25, better: 0.45, best: 0.55 },
  insulative: { typical: 0.18, good: 0.20, better: 0.40, best: 0.50 },
  shell:      { typical: 0.14, good: 0.15, better: 0.35, best: 0.45 }
};
const ENSEMBLE_LAYER_NAMES = ['Base Layer','Mid Layer','Insulative Layer','Shell / Outer'];
const ENSEMBLE_LAYER_KEYS = ['base','mid','insulative','shell'];
// calcEnsembleIm: accepts 4-element tier array (from upGen) — only rated vapor-transfer layers included
// Insulative layer (index 2) excluded — affects CLO/heat retention, not vapor transfer circuit

// ===== risk_functions.js lines 865-1086 =====
function calcEnsembleIm(tiers) {
  if(typeof tiers==="string"){tiers=[arguments[0],arguments[1],null,arguments[2]]}
  const layers=[];
  ENSEMBLE_LAYER_KEYS.forEach((key,i)=>{
    // PHY-068/BUG-140: insulative IS in vapor pathway — include in harmonic mean
    // ENSEMBLE_IM_MAP already has insulative values (typical:0.18, good:0.20, better:0.40, best:0.50)
    const tier=tiers[i];
    if(!tier)return; // layer not rated — skip
    const im=ENSEMBLE_IM_MAP[key][tier];
    if(!im)return; // unknown tier — skip
    layers.push({key,idx:i,name:ENSEMBLE_LAYER_NAMES[i],tier,im});
  });
  if(layers.length===0)return{ensembleIm:0,bottleneck:null,bottleneckIm:0,bottleneckPct:0,layers,hasGear:false};
  if(layers.length===1)return{ensembleIm:layers[0].im,bottleneck:layers[0].name,bottleneckIm:layers[0].im,bottleneckPct:100,layers,hasGear:true};
  // Serial resistance: harmonic mean — weakest link dominates
  const totalInvIm=layers.reduce((s,l)=>s+1/l.im,0);
  const ensembleIm=layers.length/totalInvIm;
  // Identify bottleneck (lowest im = highest resistance)
  let bottleneck=layers[0],bottleneckIm=layers[0].im;
  layers.forEach(l=>{if(l.im<bottleneckIm){bottleneck=l;bottleneckIm=l.im}});
  const bottleneckPct=Math.round((1/bottleneckIm)/totalInvIm*100);
  // What-if: compute improvement if bottleneck upgraded to "best"
  const upgradedTiers=[...tiers];
  upgradedTiers[bottleneck.idx]="best";
  const upgLayers=[];
  ENSEMBLE_LAYER_KEYS.forEach((key,i)=>{
    // BUG-140: include insulative in upgrade what-if too
    const t=upgradedTiers[i];if(!t)return;
    const uim=ENSEMBLE_IM_MAP[key][t];if(!uim)return;
    upgLayers.push({im:uim});
  });
  const upgInvIm=upgLayers.reduce((s,l)=>s+1/l.im,0);
  const upgEnsembleIm=upgLayers.length/upgInvIm;
  const whatIfImprovement=ensembleIm>0?Math.round((upgEnsembleIm/ensembleIm-1)*100):0;
  return{ensembleIm,bottleneck:bottleneck.name,bottleneckKey:bottleneck.key,bottleneckIdx:bottleneck.idx,bottleneckIm,bottleneckPct,bottleneckTier:bottleneck.tier,whatIfImprovement,upgEnsembleIm,layers,hasGear:true};
}

// UPG-012: Immersion gear data
// rValue: thermal insulation in clo (1 clo = 0.155 m²·K/W). Primary input for thermal model.
//   Sources: Tikuisis (1997) neoprene wet-clo, ISO 15027 immersion suit testing,
//   manufacturer specs adjusted for water flush degradation.
// wetting: external splash/seepage rate in L/hr (kayak values; SUP ×0.5).
//   Feeds moistureRisk() for fabric saturation, not thermal model.
const IMMERSION_SHIELD={
  // Kayak / SUP gear
  // R-values calibrated against USCG Cold Water Safety Guide survival brackets.
  // Critical clo threshold: 1.22 clo = shivering equilibrium in 32°F capsize.
  // Recreational gear MUST be below this to produce non-zero capsize scores.
  // Old values (3.0/2.0/1.5) modeled expedition immersion suits — unrealistically high.
  drysuit:          {wetting:0,    rValue:0.80},  // shell + moderate underlayers → ~3hr capsize @32°F
  wetsuit_43:       {wetting:0.05, rValue:0.55},  // 4/3mm neoprene, good fit → ~90min capsize
  wetsuit_32:       {wetting:0.08, rValue:0.40},  // 3/2mm neoprene → ~65min capsize
  farmer_john:      {wetting:0.10, rValue:0.30},  // sleeveless, arms exposed → ~54min capsize
  splash:           {wetting:0.18, rValue:0.08},  // splash jacket only → ~34min capsize
  no_gear:          {wetting:0.22, rValue:0},     // regular clothing → ~29min capsize
  // Fishing wading gear
  neoprene_5mm:     {wetting:0,    rValue:0.55},  // chest waders, sealed, good insulation
  neoprene_3mm:     {wetting:0,    rValue:0.40},  // lighter neoprene waders
  breathable_waders:{wetting:0,    rValue:0.15},  // Gore-Tex waders — dry but low thermal R
  wet_wading:       {wetting:0.15, rValue:0},     // no waders, direct skin contact
};

// PHY-052: Wader-aware split-body model — legs ≠ torso when wading
// im = Woodcock permeability index for lower body. clo = thermal insulation of wader material.
// label = display name for UI. Upper body (45%) uses normal im_ensemble. Lower (55%) uses wader im/clo.
const WADER_DATA={
  neoprene_5mm:     {im:0.00, clo:1.50, label:'Neoprene 5mm'},
  neoprene_3mm:     {im:0.00, clo:0.70, label:'Neoprene 3mm'},
  neoprene_3_5mm:   {im:0.00, clo:0.90, label:'Neoprene 3.5mm'},
  breathable:       {im:0.15, clo:0.15, label:'Breathable'},
  breathable_budget:{im:0.10, clo:0.15, label:'Breathable (budget)'},
  breathable_fleece:{im:0.15, clo:0.75, label:'Breathable + fleece'},
  breathable_expedition:{im:0.15, clo:1.10, label:'Breathable + expedition'},
  wet_wading_3mm:   {im:0.00, clo:0.25, label:'Wet wading (3mm sock)'},
  wet_wading_2mm:   {im:0.00, clo:0.20, label:'Wet wading (2mm sock)'},
  none:             {im:0.00, clo:0.00, label:'No waders'}
};
// Split-body im: 45% upper body (normal im_ensemble) + 55% lower body (wader im)
function waderSplitIm(ensembleIm,waderType){
  if(!waderType||waderType==='none'||!WADER_DATA[waderType])return ensembleIm;
  var upper=ensembleIm||BASELINE_IM;
  var lower=WADER_DATA[waderType].im;
  return 0.45*upper+0.55*lower;
}
// Split-body CLO: 45% upper (existing estimate) + 55% lower (wader CLO)
function waderSplitCLO(upperCLO,waderType){
  if(!waderType||waderType==='none'||!WADER_DATA[waderType])return upperCLO;
  return 0.45*upperCLO+0.55*WADER_DATA[waderType].clo;
}

// PHY-065: Snow sport split-body im — sealed extremities limit whole-body vapor transfer
// Same architecture as waderSplitIm (fishing). Skiing/snowboarding have mandatory sealed
// barriers (boots, gloves, helmet, goggles, insulated pants) covering ~51% of BSA.
// Sources:
//   BSA fractions: ANSUR II (2012) anthropometric survey
//   Boot im: ski boots are rigid plastic — effectively im ≈ 0 for vapor (ISO 9920)
//   Glove im: insulated ski gloves im 0.03-0.05 (Havenith 2002, Table 4)
//   Helmet im: hard shell + foam liner — negligible vapor transfer
//   Ski pants im: insulated waterproof — im 0.08-0.12 (ISO 9920 Category E)
// PHY-065c: Snow sport BSA zones — Rule of Nines (medical TBSA standard)
// Technical shell pants use same membrane as jacket = part of layering system.
// Sources: Rule of Nines, ANSUR II 2012, Havenith 2002, ISO 9920
var SNOW_SPORT_ZONES = {
  layeringSystem: {frac: 0.80, usesEnsemble: true},  // trunk 36% + arms 18% + upper legs 26%
  hands:     {frac: 0.05, im: 0.05},   // gloves: leather palm + breathable back, merino liner
  head:      {frac: 0.05, im: 0.03},   // helmet: hard shell + wicking liner
  feet:      {frac: 0.04, im: 0.02},   // ski boots: rigid plastic, merino socks inside
  calves:    {frac: 0.04, im: 0.01},   // inside rigid boot shaft
  face:      {frac: 0.02, im: 0.01}    // goggles: sealed foam + lens
};
function snowSportSplitIm(ensembleIm) {
  var ens = ensembleIm || BASELINE_IM;
  var z = SNOW_SPORT_ZONES;
  return z.layeringSystem.frac * ens +
    z.hands.frac * z.hands.im +
    z.head.frac * z.head.im +
    z.feet.frac * z.feet.im +
    z.calves.frac * z.calves.im +
    z.face.frac * z.face.im;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATER IMMERSION THERMAL MODEL — Newton's law of cooling, no fudge factors
// ═══════════════════════════════════════════════════════════════════════════════
// Q̇ = A × (T_core − T_water) / (R_tissue + R_gear + R_boundary)
//
// References:
//   Tikuisis P. (1997) "Predicting survival time for cold exposure" —
//     regression model from 234 immersion experiments, ±15% accuracy
//   Wissler E. (2003) "Whole-body human thermal model" —
//     tissue conductance and vasoconstriction parameters
//   Hayward JS, Eckerson JD, Collis ML (1975) "Thermoregulatory heat production
//     in man" — shivering thermogenesis capacity ~2.5 W/kg
//   ISO 15027-3: Immersion suit thermal performance test standard
//   DuBois D, DuBois EF (1916) "A formula to estimate surface area" — BSA
//   Regan MJ, Bullard RW (1963) — water convective heat transfer coefficients
//   USCG/NCCWS cold water survival time brackets — score mapping basis
// ═══════════════════════════════════════════════════════════════════════════════

// Fractional body surface area immersed during normal activity (not capsize).
// Observable measurement, not a calibration constant.
const IMMERSED_FRACTION={
  kayaking_creek:0.55,   // lower body seated + frequent splash/wave wash
  kayaking_ocean:0.50,   // seated, moderate wave splash
  kayaking_flat:0.45,    // seated in cockpit, minimal splash
  paddle_boarding:0.15,  // feet + occasional fall splash
  fishing_wading:0.35,   // legs submerged to thigh
  fishing_shore:0,       // not in water
};

// Convective heat transfer coefficient h_water (W/m²·K)
// From fluid dynamics — depends on water velocity past the body.
// Boutelier (1977), Regan & Bullard (1963).
const H_WATER={
  creek:300,     // fast-moving whitewater, high turbulence
  ocean:200,     // surf zone / tidal current
  flat:120,      // calm lake or slow river
  wading:100,    // standing in slow current
};

// PHY-059: Roll cooling event parameters for creek/whitewater kayaking
// Per-roll: Q = h_water × A_exposed × ΔT × duration
// Refs: Boutelier 1977, Regan & Bullard 1963 (convective coefficients)
// Giesbrecht cold shock: head/neck submersion triggers gasp reflex + rapid cooling
var ROLL_COOLING = {
  rollDurationSec: 8,       // Average combat roll duration (Whitewater Kayaking, Kent Ford)
  exposedAreaM2: 0.30,      // Head (0.07) + neck (0.03) + upper shoulders (0.20)
  drysuitReduction: 0.30,   // Drysuit hood + gaskets block 70% of heat extraction
  wetsuitReduction: 0.60,   // Wetsuit hood blocks ~40%
  noGearReduction: 1.0,     // Full heat extraction
  // Rolls per hour by difficulty class (USCG/AW difficulty scale)
  rollsPerHour: {
    recreational: 0,   // Class I-II: no combat rolls expected
    intermediate: 2,   // Class III: occasional roll in features
    advanced: 5,       // Class IV: regular rolls in heavy water
    expert: 10,        // Class V: continuous rolls, heavy features
  },
};

// Metabolic heat production (Watts) during activity.
// From exercise physiology: MET × 3.5 × mass_kg / 200 → kcal/min → ×69.8 for Watts.
// Values here are for a 75kg person at moderate intensity; scaled by mass in the function.
const IMMERSION_MET_WATTS={
  kayaking:4.7,          // ~350W at 75kg — moderate paddling (MET≈6.3)
  paddle_boarding:3.3,   // ~250W at 75kg — moderate effort (MET≈4.5)
  fishing:1.6,           // ~120W at 75kg — standing/wading (MET≈2.1)
};

// Maximum shivering thermogenesis: ~2.5 W/kg (Hayward 1975, Tikuisis 1997).
// This is the body's last-resort heat production when voluntary movement stops.
const SHIVER_W_PER_KG=2.5;

/**
 * 4-Phase Cold Water Danger Model
 *
 * Based on critique by Moulton Avery (coldwatersafety.org) and Golden & Tipton
 * "Essentials of Sea Survival" (2002): most cold water deaths are from DROWNING,
 * not hypothermia. Traditional survival charts only model Phase 3, giving a false
 * sense of security. This model scores danger across all three lethal phases:
 *
 *   Phase 1: Cold Shock (0-3 min) — gasp reflex, cardiac arrest (Tipton 1989)
 *   Phase 2: Swimming Failure / Incapacitation (3-30 min) — loss of motor control
 *   Phase 3: Hypothermia (30+ min) — core cooling via Newton's law
 *
 * Combined: max(phase1, phase2, phase3) — because if cold shock kills in 2 min,
 * it doesn't matter that hypothermia takes 3 hours.
 *
 * Two scenarios: continuous (paddling/wading) and capsize (full immersion).
 *
 * @param {number} waterTempF  — water temperature in °F
 * @param {string} gearType    — key into IMMERSION_SHIELD (e.g. "drysuit", "wetsuit_43")
 * @param {string} activity    — "kayaking"|"paddle_boarding"|"fishing"
 * @param {string} kayakType   — "creek"|"ocean"|"flat"|null
 * @param {boolean} fishWading — true if wading (legs in water)
 * @param {number} weightLb    — body weight in pounds
 * @param {string} sex         — "male"|"female" (affects body fat estimate)
 * @param {number} airTempF    — air temperature in °F
 * @param {number} windMph     — wind speed in mph
 * @returns {{score, continuousScore, capsizeScore, coldShockScore, incapScore,
 *            hypothermiaScore, capsizeColdShock, capsizeIncap, capsizeHypothermia,
 *            timeToHypoMin, capsizeTimeMin, incapTimeMin,
 *            Q_water, Q_air, Q_met, Q_net}}

// ===== risk_functions.js lines 1438-1666 =====
function descentSpeedWind(variant){
  // PHY-030: Unified terrain keys (ski = snowboard). Strip sport prefix for backward compat.
  if(typeof variant!=="string")return{speed:25,turnFactor:0.6};
  var _v=variant.replace(/^(skiing|snowboarding)_/,"");
  var data={
    groomers:{speed:30,turnFactor:0.7},   // 20-35 mph avg, medium-radius turns
    moguls:{speed:12,turnFactor:0.5},      // 8-15 mph, constant tight turns
    trees:{speed:8,turnFactor:0.45},       // 5-12 mph, line-picking pauses
    bowls:{speed:20,turnFactor:0.6},       // 15-25 mph, open steeps/chutes
    park:{speed:18,turnFactor:0.55},       // 12-22 mph approach between features
  };
  return data[_v]||{speed:25,turnFactor:0.6};
}
// Phase profiles for intermittent activities — Compendium of Physical Activities (Ainsworth et al., 2011)
// Replaces flat intensity × intermittency approximation with explicit per-phase duty cycle physics
const INTERMITTENT_PHASE_PROFILES = {
  // PHY-031: Unified resort terrain profiles — ski = snowboard per terrain
  // Lift ride = 7 min (high-speed quad western avg). Mogul run 10→7 (SkiTalk/AlpineZone data).
  // Per-cycle physics phases only (run+lift). Transition+line+rest handled by cycleOverride.
  groomers: { type:"cyclic", phases:[
    {name:"run",durMin:3,intensity:"moderate",windType:"skiing_descent",canVent:false},
    {name:"lift",durMin:7,intensity:"low",windType:"ambient",canVent:false},
  ]},
  moguls: { type:"cyclic", phases:[
    {name:"run",durMin:7,intensity:"very_high",windType:"skiing_descent",canVent:false},
    {name:"lift",durMin:7,intensity:"low",windType:"ambient",canVent:false},
  ]},
  trees: { type:"cyclic", phases:[
    {name:"run",durMin:10,intensity:"high",windType:"skiing_descent",canVent:false},
    {name:"lift",durMin:7,intensity:"low",windType:"ambient",canVent:false},
  ]},
  bowls: { type:"cyclic", phases:[
    {name:"run",durMin:6,intensity:"high",windType:"skiing_descent",canVent:false},
    {name:"lift",durMin:7,intensity:"low",windType:"ambient",canVent:false},
  ]},
  park: { type:"cyclic", phases:[
    {name:"run",durMin:4,intensity:"moderate",windType:"skiing_descent",canVent:false},
    {name:"lift",durMin:7,intensity:"low",windType:"ambient",canVent:false},
  ]},
  // Backcountry ski/splitboard: skinning → summit transition → descent (linear, not cyclic)
  // Skinning ≈ vigorous XC (Compendium 19180, 8.0 METs) with heavy gear → very_high
  // Transition: stopped, near-basal. Descent: moderate-high skiing (Compendium 19150, 5.3 METs)
  skiing_bc: { type:"linear", phases:[
    {name:"skinning",pct:0.55,intensity:"very_high",windType:"walking",canVent:true},
    {name:"transition",pct:0.05,intensity:"low",windType:"ridge",canVent:true},
    {name:"descent",pct:0.40,intensity:"high",windType:"speed",canVent:false},
  ]},
  // Golf walking: 4 min walk+swing + 11 min wait → ~4 holes/hr
  // Source: Compendium 15255 (golf, walking, carrying clubs 4.3 METs)
  golf_walk: { type:"cyclic", phases:[
    {name:"walk_swing",durMin:4,intensity:"moderate",windType:"ambient",canVent:true},
    {name:"wait",durMin:11,intensity:"low",windType:"ambient",canVent:true},
  ]},
  // Golf cart: 0.5 min swing + 14.5 min ride/wait → ~4 holes/hr
  // Source: Compendium 15238 (golf, riding cart 3.5 METs average)
  golf_cart: { type:"cyclic", phases:[
    {name:"swing",durMin:0.5,intensity:"moderate",windType:"calm",canVent:true},
    {name:"ride_wait",durMin:14.5,intensity:"low",windType:"cart",canVent:true},
  ]},
  // Fishing shore/boat (stationary): 2.5 min cast/retrieve + 10 min wait
  // Source: Compendium 04001 (fishing, general 3.5 METs)
  fishing_shore: { type:"cyclic", phases:[
    {name:"cast",durMin:2.5,intensity:"moderate",windType:"ambient",canVent:true},
    {name:"wait",durMin:10,intensity:"low",windType:"ambient",canVent:true},
  ]},
  // Fishing wading: 5 min wade/reposition + 2.5 min cast + 5 min wait
  // Source: Compendium 04050 (fishing in stream, wading 6.0 METs)
  // Wading against current raises metabolic rate significantly vs shore fishing
  fishing_wading: { type:"cyclic", phases:[
    {name:"wade",durMin:5,intensity:"moderate",windType:"ambient",canVent:true},
    {name:"cast",durMin:2.5,intensity:"moderate",windType:"ambient",canVent:true},
    {name:"wait",durMin:5,intensity:"low",windType:"ambient",canVent:true},
  ]},
  // Kayaking — creek/whitewater: 10 min rapids + 3 min eddy (spray deck sealed throughout)
  // Compendium 18115: whitewater kayaking = 8.0 METs → very_high; eddy = near-basal recovery
  // Spray deck remains sealed in eddy — no venting opportunity. Sheltered eddy = calm wind.
  // Primary creek vs lake differentiator is immersion risk (external wetting), not sweat alone.
  kayaking_creek: { type:"cyclic", phases:[
    {name:"rapids",durMin:10,intensity:"very_high",windType:"kayak",canVent:false},
    {name:"eddy",durMin:3,intensity:"low",windType:"calm",canVent:false},
  ]},
  // Kayaking — lake/flatwater: 15 min sustained paddle + 7.5 min drift
  // Compendium 18090: kayaking moderate = 5.0 METs. Drift allows passive venting.
  kayaking_lake: { type:"cyclic", phases:[
    {name:"paddle",durMin:15,intensity:"high",windType:"kayak",canVent:false},
    {name:"drift",durMin:7.5,intensity:"low",windType:"ambient",canVent:true},
  ]},
  // Kayaking — ocean/sea: 20 min sustained paddle + 5 min rest (swell, current, longer sets)
  // More continuous effort than lake; less rest. Wind exposure on open water.
  kayaking_ocean: { type:"cyclic", phases:[
    {name:"paddle",durMin:20,intensity:"high",windType:"kayak",canVent:false},
    {name:"rest",durMin:5,intensity:"low",windType:"ambient",canVent:true},
  ]},
  // SUP — lake: 12 min paddle + 6 min rest. Upright posture, full-body balance.
  // Compendium 18095: paddleboarding = 6.0 METs. Less upper-body enclosure → better ventilation.
  // coverageMul 0.95 (vs kayak 1.1) reflects more exposed upper body on SUP.
  sup_lake: { type:"cyclic", phases:[
    {name:"paddle",durMin:12,intensity:"moderate",windType:"kayak",canVent:true},
    {name:"rest",durMin:6,intensity:"low",windType:"ambient",canVent:true},
  ]},
  // SUP — ocean: 18 min sustained + 4 min rest. Ocean touring demands higher sustained output.
  sup_ocean: { type:"cyclic", phases:[
    {name:"paddle",durMin:18,intensity:"high",windType:"kayak",canVent:false},
    {name:"rest",durMin:4,intensity:"low",windType:"ambient",canVent:true},
  ]},
  // SUP — creek: whitewater SUP, very high intensity, sealed position for balance
  sup_creek: { type:"cyclic", phases:[
    {name:"rapids",durMin:10,intensity:"very_high",windType:"kayak",canVent:false},
    {name:"eddy",durMin:3,intensity:"low",windType:"calm",canVent:false},
  ]},
  // Road cycling — flat: sustained high effort, ~15% stops (lights, junctions)
  // Compendium 01015 (14-16 mph = 10.0 METs). Flat = no climb/descent intensity swings.
  // cycling_speed wind throughout — consistent forward-motion wind cooling.
  cycling_road_flat: { type:"cyclic", phases:[
    {name:"ride",durMin:51,intensity:"high",windType:"cycling_speed",canVent:true},
    {name:"stop",durMin:9,intensity:"low",windType:"ambient",canVent:true},
  ]},
  // Gravel cycling — flat: slightly lower intensity than road flat, variable surface
  // Compendium 01013 (12-14 mph = 8.0 METs). ~20% recovery/variable terrain.
  cycling_gravel_flat: { type:"cyclic", phases:[
    {name:"ride",durMin:48,intensity:"high",windType:"cycling_speed",canVent:true},
    {name:"recovery",durMin:12,intensity:"moderate",windType:"cycling_speed",canVent:true},
  ]},
  // Road cycling hilly: climb/flat/descent cycle ~45 min
  // Source: Compendium 01015 (cycling 14-16 mph, 10.0 METs), 01013 (12-14 mph, 8.0 METs),
  // 01009 (coasting/descent, ~3.0 METs)
  cycling_road_hilly: { type:"cyclic", phases:[
    {name:"climb",durMin:18,intensity:"very_high",windType:"headwind_low",canVent:true},
    {name:"flat",durMin:13.5,intensity:"high",windType:"cycling_speed",canVent:true},
    {name:"descent",durMin:13.5,intensity:"low",windType:"descent_speed",canVent:false},
  ]},
  // Gravel cycling hilly: longer climbs, slower descents ~50 min cycle
  // Source: Compendium 01009 adjusted for gravel surface resistance
  cycling_gravel_hilly: { type:"cyclic", phases:[
    {name:"climb",durMin:22.5,intensity:"high",windType:"headwind_low",canVent:true},
    {name:"flat",durMin:12.5,intensity:"high",windType:"cycling_speed",canVent:true},
    {name:"descent",durMin:15,intensity:"low",windType:"descent_speed",canVent:false},
  ]},
  // XC skiing: sustained push phase + glide/descent phase (linear, not cyclic)
  // Compendium 19180: XC ski vigorous = 9.0 METs (push/uphill); 19170: moderate = 6.8 METs (flat/glide)
  // Descent glide sealed: speed wind, low vent opportunity. Push/flat: vented via collar/zipper.
  // Phase split: ~55% push (uphill+flat effort), ~5% transition, ~40% glide/descent
  // Same linear sub-step structure as skiing_bc — fabric-cap drain correctly bounds long trips.
  xc_ski: { type:"linear", phases:[
    {name:"push",pct:0.55,intensity:"high",windType:"walking",canVent:true},
    {name:"transition",pct:0.05,intensity:"moderate",windType:"walking",canVent:true},
    {name:"glide",pct:0.40,intensity:"moderate",windType:"speed",canVent:false},
  ]},
  // Snowshoeing: sustained uphill + descent (linear, same structure as XC ski / BC ski)
  // Compendium 17152: snowshoeing uphill = 8.3 METs (high); flat/descent ~5.3 METs (moderate)
  // Ascent: vented (collar, vent zipper accessible). Descent: sealed against speed wind.
  // Phase split: 60% ascent / 40% descent (standard out-and-back mountain profile)
  snowshoeing: { type:"linear", phases:[
    {name:"ascent",pct:0.60,intensity:"high",windType:"walking",canVent:true},
    {name:"descent",pct:0.40,intensity:"moderate",windType:"ambient",canVent:false},
  ]},
};
// PHY-041: Phase thermal asymmetry — determines session-gauge HL method
// Activities with real thermal swings between active/rest phases use lift-phase 2/3 point.
// Activities that feel roughly uniform across phases use direct heatLossRisk().
// Classification based on actual Compendium METs (not intensity-label proxies):
//   Skiing (all terrains): 5-10 METs run vs 1.5 lift → 3-7× → 2/3 point
//   Cycling (all): 6-10 METs ride vs 1.5-3 stop → 3-4× → 2/3 point
//   Snowshoeing: 8 ascent vs 5 descent → 1.6× → direct
//   Kayaking: 5-8 paddle vs 1.5 drift → 2.5-5× → borderline, use direct (mostly uniform effort)
//   Golf: 3 walk/swing vs 2.5 wait → 1.2× → direct
//   Fishing: 2 cast vs 1.5 wait → 1.3× → direct
//   Hunting treestand: 1.5 all phases → 1.0× → direct
// Direct calc: uniform thermal experience — "I'm basically at one temperature the whole time"
// 2/3 point: real thermal swings — "I'm hot during effort and cold between"
// Creek kayaking: rapids vs eddy IS real asymmetry (6-8 METs + cold water splash → 2 METs stationary wet)
var _DIRECT_HL_ACTIVITIES={fishing:true,golf:true,hunting:true,paddle_boarding:true,kayaking:true,snowshoeing:true,camping:true};
// Override: creek kayaking has real asymmetry despite kayaking being in direct list
var _ASYMMETRIC_OVERRIDES={kayaking_creek:true};
function hasPhaseAsymmetry(activity,kayakType){
  if(activity==='kayaking'&&kayakType==='creek')return true; // rapids vs eddy = real thermal swing
  return !_DIRECT_HL_ACTIVITIES[activity]; // true = 2/3 point, false = direct calc
}
// Backcountry skiing: derive phase percentages from vertical gain
// Physics: skinning rate ~1500 ft/hr, transition ~10 min fixed, descent varies by terrain
// Returns {skinning, transition, descent} as fractions summing to 1.0
// When no verticalGainFt provided, returns null → use default 55/5/40
function calcBCPhasePercentages(verticalGainFt, descentRateFtPerHr) {
  if (!verticalGainFt || verticalGainFt <= 0) return null;
  const skinningHrs = verticalGainFt / 1500;
  const transitionHrs = 10 / 60;
  const descentHrs = verticalGainFt / (descentRateFtPerHr || 4000);
  const totalPhaseHrs = skinningHrs + transitionHrs + descentHrs;
  return {
    skinning: skinningHrs / totalPhaseHrs,
    transition: transitionHrs / totalPhaseHrs,
    descent: descentHrs / totalPhaseHrs
  };
}

// Multi-lap backcountry skiing: cumulative moisture across laps with inter-lap reset
// Physics: ~15-20 min transition between laps — shell open, moderate evaporation.
// Deep-wicked moisture in mid-layer remains. 40% dissipates per inter-lap rest.
const INTER_LAP_RESET_FRACTION = 0.40;

function calcMultiLapMoisture(singleLapMoisture, numLaps, saturationCap) {
  if (!numLaps || numLaps <= 1) return { finalMoisture: singleLapMoisture, lapResults: null };
  let cumulative = 0;
  const lapResults = [];
  for (let lap = 1; lap <= numLaps; lap++) {
    const startMoisture = cumulative;
    cumulative = Math.min(cumulative + singleLapMoisture, saturationCap);
    const capped = cumulative >= saturationCap;
    if (lap < numLaps) {
      const carryMoisture = cumulative * (1 - INTER_LAP_RESET_FRACTION);
      lapResults.push({ lap, startMoisture, endMoisture: cumulative, capped, carryMoisture });
      cumulative = carryMoisture;
    } else {
      lapResults.push({ lap, startMoisture, endMoisture: cumulative, capped, carryMoisture: cumulative });
    }
  }
  return { finalMoisture: cumulative, lapResults };
}

// PHY-020: Personalized pack weight — Pandolf et al. 1977
// packWeight = min(bodyWeight * 0.20, seasonMax)
// Returns pack weight in lbs (0 for activities without packs)
var PACK_SEASON_MAX={
  backpacking:{winter:35,summer:20},
  climbing:{winter:30,summer:25},     // rock climbing approach
  snowshoeing:{winter:20,summer:0},
  skiing:{winter:30,summer:0},        // BC touring only (avi gear, skins)
  mountain_biking:{winter:10,summer:8},
  hunting:{winter:25,summer:20},      // upland: gun+vest+shells

// ===== risk_functions.js lines 1700-1714 =====
function breakResetFactor(breakDurationMin){
  if(breakDurationMin<=5)return 0.92;
  if(breakDurationMin<=10)return 0.85; // current v5.5 default — zero change
  if(breakDurationMin<=15)return 0.80;
  if(breakDurationMin<=30)return 0.70;
  return 0.65;
}

// PHY-024: Fitness-Adjusted Thermal Model — tier constants, body-fat estimator, profile builder
var FITNESS_TIERS = {
  sedentary: { bfAdj: 2, sweatMul: 0.85, onsetAdj: 15, coldTol: 0.90 },
  active:    { bfAdj:-2, sweatMul: 1.00, onsetAdj: 0,  coldTol: 1.00 },
  athletic:  { bfAdj:-8, sweatMul: 1.15, onsetAdj:-10, coldTol: 1.10 },
  elite:     { bfAdj:-13, sweatMul: 1.30, onsetAdj:-20, coldTol: 1.20 },
};

// ===== risk_functions.js lines 1810-1996 =====
function sweatRate(intensity,tempF,humidity,sex,weightLb,activity,immersionGear,paceMul,golfCartRiding,descentMul,snowTerrain,packLoadMul,elevFt,fitnessProfile){
  const isDrysuit=immersionGear==="drysuit"||immersionGear===true;
  const profile=ACTIVITY_SWEAT_PROFILES[activity]||ACTIVITY_SWEAT_PROFILES.hiking;
  let base=profile[intensity]||profile.moderate;
  if(activity==="golf"&&golfCartRiding){
    base=base*0.45; // ~45% of walking metabolic output — mostly standing, short walks tee-to-ball
  }
  const effectiveTemp=isDrysuit?Math.max(tempF,Math.min(80,tempF+30)):tempF; // suit interior ~30°F warmer than ambient
  const rawTempMul=effectiveTemp>80?1.5:effectiveTemp>65?1.0:effectiveTemp>45?0.6:effectiveTemp>30?0.35:0.2;
  // Cold-weather sweat: f_e (clothingInsulation) models microclimate heating from
  // CLO heat trapping at each intensity level. No separate intensity floor needed.
  // Audit complete (Session E): XC ski MFC #2 validated f_e alone at 18°F.
  // All activities now use f_e only. See clothingInsulation() line 378.
  const tempMul=rawTempMul;
  const humMul=1+(Math.max(humidity-40,0)/100)*0.8; // high humidity slows evaporation → body compensates by sweating more
  const sexMul=(sex==="female")?0.75:1.0;
  const wt=weightLb||150;
  const wtMul=0.6+(wt/170)*0.4; // scales from ~0.6 at 100lb to ~1.18 at 200lb
  const cloMul=clothingInsulation(tempF, intensity);
  let effIntermittency=profile.intermittency;
  if(activity==="bouldering"&&paceMul&&paceMul!==1.0){
    const shift=(paceMul-1.0)*0.22;
    effIntermittency=Math.max(0.25,Math.min(0.75,profile.intermittency+shift));
  }
  if(activity==="golf"&&golfCartRiding){
    effIntermittency=0.30; // down from 0.50 walking — mostly seated/standing near cart
  }
  // Skiing/snowboarding: intermittency does NOT reduce sweat production
  // Body produces full metabolic sweat during each run regardless of lift time
  // Terrain-based intensity override (effInt in app.jsx) captures MET rate differences:
  //   groomers → moderate (4-5 METs), moguls/trees → high (6-8 METs), backcountry → very_high (8-10 METs)
  // The lift-ride thermodynamic cycle (sweat→seal→cool→repeat) is modeled in moistureRisk, not here
  const isSki=activity==="skiing"||activity==="snowboarding";
  if(isSki){
    effIntermittency=1.0;
  }
  // packLoadMul: overnight pack increases metabolic cost — Pandolf equation: cost ∝ (bodyWt+loadWt)/bodyWt
  // altitudeFactors.metabolic: VO2max drops at altitude → same work requires more metabolic effort → more sweat
  const altMet=altitudeFactors(elevFt).metabolic;
  var _fitSweat=fitnessProfile?fitnessProfile.sweatMul:1.0;
  // ECO-001: VO2-based metabolic efficiency — MET-aware sweat scaling
  var _metEff=1.0;
  if(fitnessProfile&&(fitnessProfile.vo2max||fitnessProfile.restingHR)){
    var _metMap={low:3,moderate:5,high:7,very_high:9};
    var _actMET=_metMap[intensity]||5;
    _metEff=getMetabolicEfficiency(_actMET,fitnessProfile.vo2max,null,sex,fitnessProfile.restingHR);
    // Don't double-count fitness tier sweatMul when VO2 is driving the model
    _fitSweat=1.0;
  }
  // PHY-061: Insensible perspiration floor (Gagge 1996, ASHRAE Fundamentals Ch9)
  // Transepidermal water loss: 300-400 mL/day (12-17 mL/hr), always present.
  // Only affects low-MET activities where active sweating < 15 mL/hr.
  var _activeSweat=base*tempMul*cloMul*humMul*sexMul*wtMul*profile.coverageMul*effIntermittency*(descentMul||1.0)*(packLoadMul||1.0)*altMet*_fitSweat*_metEff;
  return Math.max(15,_activeSweat);
}
const INTENSITY_ORDER=["low","moderate","high","very_high"];
function getEffectiveIntensity(activity,userPaceVal,actObj,sex,weightLb){
  const baseInt=actObj?.intensity||"moderate";
  if(!actObj?.hasPace||!userPaceVal)return baseInt;
  const defPace=actObj.defaultPace;
  if(!defPace||defPace<=0)return baseInt;
  const pace=parseFloat(userPaceVal);
  if(!pace||pace<=0)return baseInt;
  let paceRatio;
  if(actObj.paceUnit==="min/mi"){
    paceRatio=defPace/pace; // faster (lower min/mi) -> ratio > 1
  } else if(actObj.paceUnit==="mph"){
    paceRatio=pace/defPace; // faster (higher mph) -> ratio > 1
  } else if(actObj.paceUnit==="problems/hr"){
    paceRatio=pace/defPace; // more problems = more intense
  } else {
    return baseInt;
  }
  const wt=weightLb||150;
  const wtFactor=0.85+(wt/170)*0.15; // range ~0.85 at 100lb to ~1.03 at 200lb
  const sexFactor=(sex==="female")?0.92:1.0;
  const effRatio=paceRatio*wtFactor*sexFactor;
  const baseIdx=INTENSITY_ORDER.indexOf(baseInt);
  if(baseIdx<0)return baseInt;
  let shift=0;
  if(effRatio>=1.5) shift=2;       // much faster + heavy = big jump
  else if(effRatio>=1.25) shift=1;  // moderately faster
  else if(effRatio>=0.95) shift=0;  // about the same
  else if(effRatio>=0.7) shift=-1;  // slower
  else shift=-2;                     // much slower
  const newIdx=Math.max(0,Math.min(INTENSITY_ORDER.length-1,baseIdx+shift));
  return INTENSITY_ORDER[newIdx];
}
function paceSweatMultiplier(actObj,userPaceVal,sex,weightLb){
  if(!actObj?.hasPace||!userPaceVal)return 1.0;
  const defPace=actObj.defaultPace;
  if(!defPace||defPace<=0)return 1.0;
  const pace=parseFloat(userPaceVal);
  if(!pace||pace<=0)return 1.0;
  let paceRatio;
  if(actObj.paceUnit==="min/mi") paceRatio=defPace/pace;
  else if(actObj.paceUnit==="mph") paceRatio=pace/defPace;
  else if(actObj.paceUnit==="problems/hr") paceRatio=pace/defPace;
  else return 1.0;
  const wt=weightLb||150;
  const wtMod=0.85+(wt/170)*0.15;
  const sexMod=(sex==="female")?0.92:1.0;
  return Math.max(0.4,Math.min(2.2,paceRatio*wtMod*sexMod));
}
// Baseline ensemble im: all-average layers via serial resistance harmonic mean
// 1 / (1/0.35 + 1/0.30 + 1/0.20) = 0.089
// Used as reference so standard gear produces imFactor=1.0 (backward compatible)
const BASELINE_IM=0.089;
// PHY-025R: Typical ensemble im for users without gear input.
// Represents insulated ski jacket (im ~0.14) + basic fleece (im ~0.22) + cotton/basic synthetic (im ~0.25).
// 1 / (1/0.25 + 1/0.22 + 1/0.14) = 0.064. Rounded to 0.063 for conservative estimate.
// This is 29% BELOW BASELINE_IM, reflecting the real-world penalty of non-technical gear.
const TYPICAL_ENSEMBLE_IM=0.063;
// PHY-041: Shell wind resistance attenuates forced-convection evaporation through fabric layers
// Wind contributes to evaporation via (1) boundary layer thinning (always applies) and
// (2) forced convection THROUGH fabric (attenuated by shell wind resistance). ISO 9237.
// shellWindResistance 0-10 scale from gear database (0=no shell, 10=Gore-Tex Pro)
// Returns fraction of ambient wind that penetrates shell for forced-convection drying
function getWindPenetration(shellWindResistance){
  // 0.85 slope: even the most windproof shell allows 15% minimum
  // (seams, zippers, collar gaps always allow some air exchange)
  return 1.0-(shellWindResistance/10)*0.85;
}
// PHY-041: Natural convection minimum — body heat creates updraft even in still air (mph equivalent)
var V_BOUNDARY=2.0;
// PHY-041: Minimum retained moisture — physical limit from skin-garment boundary layer,
// yarn interstices, hygroscopic fiber absorption. Not a fudge factor — physical floor.
var MIN_RETAINED=0.005; // 5 mL
// Fabric saturation capacity: typical merino base layer holds about 180g before fully saturated
// Havenith (2002): beyond saturation, moisture migrates to outer layers, drips, pools at waist
// Used by calcIntermittentMoisture to bound cumulative accumulation with saturation-enhanced drain
// PHY-038 A5: FABRIC_CAPACITY is now the MAX reference (4-layer). Use getEnsembleCapacity(activity) for actual cap.
const FABRIC_CAPACITY=0.42; // liters — 4-layer max reference for fatigue severity denominator
// PHY-032: Hygroscopic absorption — ambient vapor absorbed by fabric fibers
// Replaces applyHumidityFloor with physics-based model via Clausius-Clapeyron + Woodcock im + ASTM D1909
var C_HYGRO=0.012; // scaling constant (L per kPa·im·regain per cycle)
var DEFAULT_REGAIN=0.004; // polyester fiber regain coefficient (ASTM D1909; merino=0.16)
// PHY-034: Cumulative insulation degradation — conductivity fatigue accumulator
// When M_trapped exceeds CROSSOVER_LITERS, liquid bridges form between fibers (25× air conductivity).
// Bridges don't fully dissolve when moisture drops — hysteresis + capillary condensation + fiber deformation.
// ScienceDirect Fig 14.4: synthetic battings lose 40-75% insulation at 50% moisture by weight.
// Wang & Havenith: 2-8% insulation decrease per perspiration event.
// PHY-034 calibration: B2 profile — see spec for alternatives
// Spec raw constants: CL=0.10, FPM=0.005, RPM=0.002, MF=0.40
// Model's accumulation curve crosses 0.10L at cycle 2 (spec assumed cycle 6),
// so FPM is lowered to hit target fatigue ranges. Alternatives:
//   B1: FPM=0.002 → moguls19F ~31%, B3: FPM=0.003 → ~36%, Spec: FPM=0.005 → ~39%
var CROSSOVER_LITERS=0.10; // onset of measurable conductivity change (~56% of 0.18L cap)
var FATIGUE_PER_MIN=0.001; // calibrated B2: moguls19F→~21%, groomers34F→~6%, fishing→~11%
var RECOVERY_PER_MIN=0.002; // asymmetric by design (surface tension hysteresis)
var MAX_FATIGUE=0.40; // cap at 40% (Paramount: fiberglass loses 20-40% R-value after drying)
var FATIGUE_SAMPLE_MIN=5; // time-step interval (captures 7-min run spikes)
// PHY-032 Addendum: Thermal time constant for CLO feedback in intermittent activities
// Havenith (2002): microclimate reaches 63% of steady-state in ~12-20 min for CLO 2.0-3.0
// Short run phases (3-10 min) never reach thermal equilibrium — scale CLO feedback accordingly
var TAU_CLOTHING=15; // minutes — time constant for multi-layer winter system (= TAU_HEAT in PHY-043)
var TAU_COOL=20; // minutes — microclimate cooling time constant (PHY-043: insulation slows heat loss)
// PHY-028c: Per-layer saturation caps (grams). Capacity determined by fabric weight × absorption factor.
// Generic tiers used when no specific gear entered. Sum ≈ 190g ≈ system total.
const LAYER_MOISTURE_CAPS={
  generic_base:70,   // conservative middle (merino~100g, synthetic~50g)
  generic_mid:65,    // fleece high-loft interstices
  generic_shell:25,  // tight weave + membrane
  air_gap:30,        // condensation on surfaces
  // Specific fabrics (used when Dial It In gear is entered)
  base_merino_250:100, base_merino_150:65, base_synthetic:50,
  mid_fleece:80, mid_down:40, mid_synthetic_ins:60,
  shell_goretex:20, shell_softshell:45
};
// PHY-038 A5: Ensemble moisture capacity scales with layer count
// Spec: SAT_CAP = 0.18 + 0.08 × (numLayers − 1)
// 2 layers (fishing/golf): 0.26L, 3 layers (hiking/XC): 0.34L, 4 layers (skiing): 0.42L, 5 layers: 0.50L
var GENERIC_LAYER_CAPS=[0.160,0.120,0.080,0.060]; // 4-layer reference, sum = 0.420
// Activity → typical layer count (default gear, not user-specific)
var ACTIVITY_LAYER_COUNT={
  skiing:4, snowboarding:4, cross_country_ski:3, snowshoeing:4,
  day_hike:3, hiking:3, backpacking:3, trail_running:2, running:2,
  road_cycling:3, gravel_biking:3, mountain_biking:3,
  climbing:3, bouldering:2,
  camping:4, fishing:2, golf:2, hunting:3,
  kayaking:2, paddle_boarding:2, skateboarding:2, onewheel:2
};
function getEnsembleCapacity(activity){
  var n=ACTIVITY_LAYER_COUNT[activity]||3;
  return 0.18+0.08*(n-1);
}
// PHY-039: Magnus formula saturation vapor pressure (Alduchov & Eskridge 1996)

// ===== risk_functions.js lines 1998-2098 =====
function satVaporPressure(tCelsius){
  return 6.1078*Math.exp((17.27*tCelsius)/(tCelsius+237.3));
}
// PHY-039: VPD-based evaporation ratio — replaces (100-H)/100 humidity term
// Reference: 20°C (68°F), 50% RH — standard exercise physiology lab environment
// where base sweat rates were originally measured (ISO 8996, Parsons 2014)
var VPD_REF=satVaporPressure(20)*(1-0.50); // ≈ 11.67 mb
function vpdRatio(tempF,humidity){
  var tC=(tempF-32)*5/9;
  var eSat=satVaporPressure(tC);
  var vpd=Math.max(0,eSat*(1-(humidity||45)/100));
  return vpd/VPD_REF;
}
// PHY-051: Humidity-dependent evaporation floor — VPD at shell-air interface shrinks with RH
// At 85% RH the vapor pressure gradient is ~73% smaller than at 45% RH (Magnus formula).
// The fixed 0.02 floor overestimates evaporative capacity in humid/rainy conditions.
function humidityFloorFactor(rh){return rh<70?1.0:Math.max(0.25,1.0-(rh-70)/60);}
// PHY-052b: Split-body evap floor — sealed waders (im=0) get NO floor on lower body (55%).
// computedEvap = raw evap rate from physics. rh = relative humidity. waderType = key into WADER_DATA.
// fishWading = boolean. Returns effective evap rate with floor applied only where appropriate.
function waderEvapFloor(computedEvap,rh,waderType,fishWading){
  var floor=0.02*humidityFloorFactor(rh);
  var upperEvap=Math.max(floor,computedEvap);
  if(!waderType||!fishWading||!WADER_DATA[waderType])return upperEvap;
  var isSealed=WADER_DATA[waderType].im===0;
  var lowerEvap=isSealed?computedEvap:Math.max(floor,computedEvap);
  return 0.45*upperEvap+0.55*lowerEvap;
}
// PHY-051: Precipitation wetting rate (L/hr) — external moisture ingress from rain/snow
// Models DWR degradation (Sefton & Sun 2015), seam ingress at interfaces, and
// shell interior condensation when ambient RH > 80%. NOT rain through intact shell.
// PHY-060: Precipitation wetting rate (L/hr) — gated by shell waterproofness + snow/rain temp
// External moisture ingress from DWR degradation (Sefton & Sun 2015), seam ingress.
// Waterproof shell (WR>=7) blocks external moisture entirely (ASTM D4966).
// Snow below 30F stays solid on shell surface — minimal melt. Wet snow 30-36F partial.
function precipWettingRate(precipProb,tempF,shellWR){
  if(precipProb<=0.5) return 0;
  var baseRate=0.03+(precipProb-0.5)*0.04; // 0.03-0.05 L/hr at 50-100% probability
  // Shell gate: waterproof membrane blocks external moisture
  var shellGate=1.0;
  if(typeof shellWR==='number'){
    if(shellWR>=7) shellGate=0.0;       // WP: Gore-Tex, eVent — sealed membrane
    else if(shellWR>=4) shellGate=0.40;  // WR: water resistant, partial penetration
    // shellWR < 4: no effective protection, full rate
  }
  // Snow/rain temp gate: powder snow doesn't wet fabric
  var tempGate=1.0;
  if(typeof tempF==='number'){
    if(tempF<30) tempGate=0.10;          // Powder snow: solid, brushes off
    else if(tempF<=36) tempGate=0.50;    // Wet snow: partial melt on contact
    // > 36F: rain, full liquid wetting
  }
  return baseRate*shellGate*tempGate;
}
// PHY-047: Surface-temperature evaporation drain rate (Yoo & Kim 2008 / Gagge / ISO 7730)
// Returns ABSOLUTE rate in g/hr (not a fraction). Caller converts to per-cycle drain.
// Evaporation from clothing outer surface to ambient air, driven by surface VPD.
// All constants sourced: Magnus (Alduchov 1996), h_c (ISO 7730), Lewis (Gagge 1996),
// f_cl (McCullough 1984), R_clo (ISO 9920), L_v (CRC Handbook).
function getDrainRate(tempF,humidity,windMph,imEnsemble,clo,bsa){
  // Clothing surface temperature (ISO 7730 thermal node model)
  var tAmbC=(tempF-32)*5/9;
  var tSkinC=30; // torso skin temp under insulation (Gagge two-node, insulated)
  var vAir=Math.max((windMph||0)*0.447,0.5); // m/s, 0.5 natural convection floor (ISO 7730 §C.2)
  var hc=8.3*Math.sqrt(vAir); // ISO 7730 forced convection coefficient
  var Rclo=(clo||1.5)*0.155; // ISO 9920: m²·K/W per CLO
  var Rair=1.0/hc; // boundary air layer resistance
  var tSurfC=tAmbC+(tSkinC-tAmbC)*(Rair/(Rclo+Rair));
  // Vapor pressures (Magnus formula, Alduchov & Eskridge 1996)
  var pSurf=6.1078*Math.exp(17.27*tSurfC/(tSurfC+237.3)); // hPa at surface temp
  var pAmb=(humidity/100)*6.1078*Math.exp(17.27*Math.max(-45,tAmbC)/(Math.max(-45,tAmbC)+237.3)); // hPa at ambient
  var vpdKpa=Math.max(0,(pSurf-pAmb)/10); // hPa → kPa
  // Evaporative transfer coefficient (Lewis relation, Gagge & Gonzalez 1996)
  var he=16.5*hc; // W/(m²·kPa)
  var fcl=1.0+0.31*(clo||1.5); // McCullough 1984 clothing area factor
  var bodyArea=bsa||2.13; // DuBois BSA default
  // Drain rate: evaporation from clothing surface (ISO 7933 resistance form)
  // Same formula as computeEmax — clothing is a vapor barrier, not a multiplier
  var Icl=(clo||1.5)*0.155; // clothing thermal resistance (m²·K/W)
  var Recl=(imEnsemble>0)?Icl/((imEnsemble||0.089)*16.5*fcl):9999;
  var Rea=1/(fcl*he);
  var Ret=Recl+Rea;
  var drainW=vpdKpa*bodyArea/Ret;
  return Math.max(0,(drainW/2430)*3600); // g/hr, no floor (0 at 100% RH)
}
// PHY-032: Hygroscopic absorption — ambient moisture entering fabric via vapor pressure gradient
// Clausius-Clapeyron actual vapor pressure × Woodcock im × fiber regain (ASTM D1909)
function hygroAbsorption(tempF,humidity,ensembleIm,regainCoeff){
  var tC=(tempF-32)*5/9;
  var eSat=0.6108*Math.exp(17.27*tC/(tC+237.3));
  var eActual=eSat*(humidity/100);
  var im=ensembleIm||BASELINE_IM;
  var regain=regainCoeff||DEFAULT_REGAIN;
  return C_HYGRO*eActual*im*regain;
}
// PHY-028b: Duration penalty after cap — differentiates long vs short sessions
// Each hour at cap adds diminishing MR penalty (log curve prevents runaway)
function applyDurationPenalty(baseMR,timeAtCapHrs){
  if(timeAtCapHrs<=0)return baseMR;
  var penalty=0.45*Math.log(1+timeAtCapHrs);
  return Math.min(10,baseMR+penalty);

// ===== risk_functions.js lines 2379-2424 =====
function warmthToCLO(warmthRating){
  var map=[0,0.10,0.20,0.30,0.50,0.70,1.00,1.30,1.60,2.00,2.50];
  var r=Math.max(1,Math.min(10,Math.round(warmthRating)));
  return map[r];
}

// PHY-049 Effect 2: Pumping effect — activity reduces effective CLO (Havenith 2002, Lu et al. 2015)
// No reduction below 2.0 MET (standing/seated). Linear ramp to 45% at 10.0 MET.
function pumpingReduction(met){
  if(met<=2.0) return 1.0;
  return 1.0-Math.min(0.45,(met-2.0)/8.0*0.45);
}

// PHY-049 Effect 3: Shell wind protection on system CLO (PMC 10024235)
// Extends existing getWindPenetration to modulate thermal resistance, not just evaporation
function windCLOProtection(shellWindResistance,windMph){
  var penetration=getWindPenetration(shellWindResistance);
  var windFactor=Math.min(1.0,windMph/15.0);
  return 1.0-penetration*windFactor*0.50;
}

// BUG-204: Static layering correction — replaces airGapBonus
// McCullough & Jones 1984 (ISO 9920): measured ensemble CLO < sum of garments.
// Compression at layer contacts + increased surface area (f_cl) > air gap benefit.
// Net: ~4% reduction per additional layer. Empirically validated against ISO 9920 Table C.1.
// Only applies at rest (MET ≤ 2.0) — pumping reduction handles movement cases independently.
// Does NOT overlap with pumping/wind/moisture corrections (separate physical mechanisms).
function staticLayeringCorrection(met,numLayers){
  if(numLayers<2||met>2.0) return 1.0;
  // 2 layers: 0.96, 3 layers: 0.92, 4 layers: 0.88, 5+: 0.84
  return 1.0-Math.min(numLayers-1,4)*0.04;
}

// PHY-049 + BUG-204: Combined dynamic CLO — gear × pumping × wind × layering correction
// Floor at 30% of baseCLO (conduction resistance persists even in worst case)
function computeEffectiveCLO(baseCLO,met,shellWR,windMph,numLayers){
  var pump=pumpingReduction(met);
  var wind=windCLOProtection(shellWR,windMph);
  var layering=staticLayeringCorrection(met,numLayers);
  var eff=baseCLO*pump*wind*layering;
  return Math.max(baseCLO*0.30,eff);
}

// Phase-based moisture accumulation for intermittent activities
// Replaces steady-state sweatRate × duration × intermittency with explicit per-phase physics
// Returns net trapped moisture (liters) → feeds into moistureRisk/gearAdjustedMoistureRisk as intermittentAccum

// ===== risk_functions.js lines 2426-3393 =====
function calcIntermittentMoisture(activity,tempF,humidity,windMph,durationHrs,sex,weightLb,paceMul,ensembleIm,snowTerrain,immersionGear,golfCartRiding,bcVerticalGainFt,fishWading,packLoadMul,kayakType,fitnessProfile,effInt,cycleOverride,shellWindRes,ventEvents,initialTrapped,totalCLOoverride,gearItems,initialLayers,precipProbability,waderType){
  const isDrysuit=immersionGear==="drysuit"||immersionGear===true;
  var _bodyMassKg=(weightLb||150)*0.453592;
  // DuBois BSA: 0.007184 × height_cm^0.725 × weight_kg^0.425 (DuBois & DuBois 1916)
  var _heightCm=_bodyMassKg<60?165:_bodyMassKg<80?173:_bodyMassKg<100?178:_bodyMassKg<120?180:_bodyMassKg<140?183:185;
  var _bsa=0.007184*Math.pow(_heightCm,0.725)*Math.pow(_bodyMassKg,0.425); // m²
  // Resolve phase profile
  const isSki=activity==="skiing"||activity==="snowboarding";
  let profileKey;
  if(isSki){
    if(snowTerrain==="backcountry")profileKey="skiing_bc";
    else {
      // PHY-030: bare terrain key (unified ski/board profiles)
      profileKey=snowTerrain==="mixed"?"moguls":(snowTerrain||"groomers");
    }
  } else if(activity==="golf"){
    profileKey=golfCartRiding?"golf_cart":"golf_walk";
  } else if(activity==="fishing"){
    profileKey=fishWading?"fishing_wading":"fishing_shore";
  } else if(activity==="kayaking"||activity==="paddle_boarding"){
    const kType=kayakType||"lake";
    if(activity==="paddle_boarding"){
      profileKey=kType==="creek"?"sup_creek":kType==="ocean"?"sup_ocean":"sup_lake";
    } else {
      profileKey=kType==="creek"?"kayaking_creek":kType==="ocean"?"kayaking_ocean":"kayaking_lake";
    }
  } else if(activity==="road_cycling"){
    profileKey=snowTerrain==="hilly"?"cycling_road_hilly":"cycling_road_flat";
  } else if(activity==="gravel_biking"){
    profileKey=snowTerrain==="hilly"?"cycling_gravel_hilly":"cycling_gravel_flat";
  // XC ski: steady-state path (not calcIntermittentMoisture). Continuous effort,
  // no lift cycle or rest phases. MFC #2 validated: 18°F, 10mph, 30%RH, 170lb.
  // Do NOT re-add XC ski here without re-running MFC #2 validation scenario.
  } else if(activity==="snowshoeing"){
    profileKey="snowshoeing";
  } else {
    profileKey=null; // steady-state activity — no intermittent profile
  }
  let profile=profileKey?INTERMITTENT_PHASE_PROFILES[profileKey]:null;
  // PHY-063: Route continuous exertion activities through the LC5 cyclic engine.
  // Hiking/backpacking/running/MTB = one long "run" phase, zero lift.
  // This ensures per-layer buffers, condensation placement, getDrainRate, and perceived MR
  // are used instead of the old evapRate-fraction model (which produces MR 0.0 at high im).
  var _continuousActivities={day_hike:true,hiking:true,backpacking:true,running:true,mountain_biking:true,trail_running:true};
  if(!profile&&_continuousActivities[activity]){
    // Synthetic hourly-cycle profile: each "cycle" = 1 hour of continuous hiking.
    // This gives the pill strip and Phase Cycle chart per-hour data points.
    // No lift phase — continuous exertion with a 5-min rest per hour (realistic).
    var _contInt=effInt||'moderate';
    var _hikeHrs=Math.max(1,Math.round(durationHrs));
    var _hikeRunMin=55; // 55 min active per hour
    var _hikeRestMin=5; // 5 min rest per hour (water break, navigation)
    profile={type:"cyclic",phases:[
      {name:"run",durMin:_hikeRunMin,intensity:_contInt,windType:"walking",canVent:true},
      {name:"rest",durMin:_hikeRestMin,intensity:"low",windType:"ambient",canVent:true}
    ]};
    if(!cycleOverride){cycleOverride={totalCycles:_hikeHrs};}
    else if(!cycleOverride.totalCycles){cycleOverride.totalCycles=_hikeHrs;}
  }
  // PHY-039B: Steady-state fallback with elevation sub-stepping
  // Activities without an intermittent profile (hiking, running, xc_skiing, mtb, etc.)
  // Sub-steps along elevation profile when available; uniform time steps otherwise.
  if(!profile){
    var _ssCap=getEnsembleCapacity(activity);
    // PHY-052: split-body im for wading in steady-state path
    var _ssIsSnow=activity==='skiing'||activity==='snowboarding';
    var _ssEffIm=waderType&&activity==='fishing'&&fishWading?waderSplitIm(ensembleIm,waderType):_ssIsSnow?snowSportSplitIm(ensembleIm):ensembleIm;
    var _ssImF=_ssEffIm?(_ssEffIm/BASELINE_IM):1.0;
    var _ssShellWR=shellWindRes!=null?shellWindRes:GENERIC_GEAR_SCORES_BY_SLOT.shell.windResist;
    var _ssWindPen=getWindPenetration(_ssShellWR);
    var _ssVEvap=V_BOUNDARY+windMph*_ssWindPen;
    var _ssInt=effInt||'moderate';
    // Build step array from elevation profile or uniform time division
    var _hasElev=cycleOverride&&cycleOverride.elevProfile&&cycleOverride.elevProfile.length>=2;
    var _epScaled=_hasElev?cycleOverride.elevProfile:null; // scaled distances (for display + step duration)
    var _epGrade=_hasElev?(cycleOverride.rawElevProfile||cycleOverride.elevProfile):null; // raw distances (for grade)
    var _dpC=cycleOverride?cycleOverride.dewPointC:null;
    var _baseElev=_hasElev?(cycleOverride.baseElevFt||0):0;
    var _totalDist=_hasElev?(cycleOverride.totalDistMi||1):0;
    var _tripStyle=_hasElev?(cycleOverride.tripStyle||'out_and_back'):'out_and_back';
    // For out-and-back: mirror both profiles for the return leg
    var _ep=_epScaled;
    var _epR=_epGrade; // raw profile for grade computation
    if(_hasElev&&_tripStyle==='out_and_back'){
      var _maxDist=_epScaled[_epScaled.length-1].dist;
      var _retPts=[];
      for(var ri=_epScaled.length-2;ri>=0;ri--){_retPts.push({dist:_maxDist+(_maxDist-_epScaled[ri].dist),elev:_epScaled[ri].elev});}
      _ep=_epScaled.concat(_retPts);
      _totalDist=_ep[_ep.length-1].dist;
      // Mirror raw profile too
      var _rawMaxDist=_epGrade[_epGrade.length-1].dist;
      var _rawRetPts=[];
      for(var rri=_epGrade.length-2;rri>=0;rri--){_rawRetPts.push({dist:_rawMaxDist+(_rawMaxDist-_epGrade[rri].dist),elev:_epGrade[rri].elev});}
      _epR=_epGrade.concat(_rawRetPts);
    }
    var N=_ep?Math.max(10,_ep.length):20;
    var _midpointIdx=Math.floor(N/2); // out-and-back: second half = descent
    var _stepDurHrs=durationHrs/N;
    var _stepDurMin=_stepDurHrs*60;
    // Pace: miles per hour (for mapping vent events from time to distance)
    var _pace=_totalDist>0?(_totalDist/durationHrs):3.0;
    var _ssTrapped=initialTrapped||0; // Trip Builder: carry-forward from previous segment
    var _ssTimeAtCap=0;
    var _perStepMR=[];
    var _perStepTrapped=[];
    var _perStepDist=[];
    var _perStepElev=[];
    for(var si=0;si<N;si++){
      // Local conditions at this step
      var _localTemp=tempF;
      var _localRH=humidity;
      var _localElev=_baseElev;
      var _isDescending=false;
      if(_ep&&si<_ep.length){
        _localElev=_ep[si].elev;
        var _elevGainFromBase=_localElev-(_ep[0]?_ep[0].elev:_baseElev);
        _localTemp=tempF+elevTempAdj(_elevGainFromBase);
        if(_dpC!=null){
          var _localTempC=(_localTemp-32)*5/9;
          _localRH=calcElevationHumidity(_localTempC,_dpC);
        }
        _isDescending=(_tripStyle==='out_and_back'&&si>_midpointIdx);
        _perStepDist.push(_ep[si].dist);
        _perStepElev.push(_localElev);
      }else{
        _perStepDist.push(si*(_totalDist/N));
        _perStepElev.push(_baseElev);
      }
      // Grade-based intensity from RAW distances (terrain property, not scaled display distances)
      var _stepGradeFtMi=0;
      if(_epR&&si>0&&si<_epR.length&&_epR[si-1]){
        var _rawDistDelta=_epR[si].dist-_epR[si-1].dist;
        if(_rawDistDelta>0.001){_stepGradeFtMi=Math.abs(_epR[si].elev-_epR[si-1].elev)/_rawDistDelta;}
      }
      // Sweat rate — reduced on descent (less metabolic output), boosted by grade on ascent
      var _descentMul=_isDescending?0.65:1.0;
      var _gradeMul=_isDescending?1.0:(_stepGradeFtMi>1000?1.4:_stepGradeFtMi>700?1.25:_stepGradeFtMi>400?1.1:1.0);
      var _stepSr=sweatRate(_ssInt,_localTemp,_localRH,sex,weightLb,activity,immersionGear,paceMul,golfCartRiding,undefined,snowTerrain,packLoadMul,undefined,fitnessProfile)*(paceMul||1.0)*_descentMul*_gradeMul;
      var _stepSweat=_stepSr*_stepDurHrs/1000; // liters
      // Evaporation: VPD at local conditions × im × wind
      var _localVpd=vpdRatio(_localTemp,_localRH);
      var _localDryBonus=_localRH<20?1.8:_localRH<30?1.4:_localRH<40?1.15:1.0;
      var _stepEvapRaw=(_ssVEvap/20)*_localVpd*_ssImF*_localDryBonus;
      var _stepEvapRate=Math.min(0.85,waderEvapFloor(_stepEvapRaw,_localRH,waderType,fishWading));
      var _stepEvap=_stepSweat*_stepEvapRate;
      _ssTrapped+=Math.max(0,_stepSweat-_stepEvap);
      // PHY-051: Per-step precipitation wetting ingress
      if(precipProbability>0&&activity!=="kayaking"&&activity!=="paddle_boarding"){_ssTrapped+=precipWettingRate(precipProbability,_localTemp,_ssShellWR)*_stepDurHrs;}
      // PHY-047: Surface-temp drain (g/hr rate, not fraction)
      var _stepDrainGhr=getDrainRate(_localTemp,_localRH,windMph,ensembleIm,activityCLO(activity),_bsa||2.13);
      var _stepDrainL=Math.min(_stepDrainGhr*_stepDurHrs/1000,_ssTrapped);
      _ssTrapped=Math.max(0,_ssTrapped-_stepDrainL);
      // Overflow drain above cap
      if(_ssTrapped>_ssCap){
        var _ovDrainGhr=getDrainRate(_localTemp,_localRH,windMph,ensembleIm,activityCLO(activity),_bsa||2.13);
        _ssTrapped=_ssCap; // excess drips off
        _ssTimeAtCap+=_stepDurHrs;
      }
      // Vent reset: check if any ventEvent falls in this step's time window
      if(ventEvents&&ventEvents.length>0){
        var _stepStartMin=si*_stepDurMin;
        var _stepEndMin=_stepStartMin+_stepDurMin;
        for(var vi=0;vi<ventEvents.length;vi++){
          var _vt=typeof ventEvents[vi]==='object'?ventEvents[vi].time:ventEvents[vi];
          var _vType=typeof ventEvents[vi]==='object'?(ventEvents[vi].type||'vent'):'vent';
          if(_vt>=_stepStartMin&&_vt<_stepEndMin){
            var _ventEff=_vType==='lodge'?0.85:(0.60*Math.max(0.3,Math.min(1.0,(_localTemp-20)/40))*Math.max(0.3,1.0-_localRH/120));
            _ssTrapped*=(1-_ventEff);
          }
        }
      }
      _perStepTrapped.push(_ssTrapped);
      _perStepMR.push(Math.min(10,Math.round(7.2*(_ssTrapped/_ssCap)*10)/10));
    }
    // sessionMR = peak MR on the trail (the worst point). NOT the end-of-hike value.
    // The user needs to plan for the worst moment, not the arrival condition.
    var _ssMR=Math.max.apply(null,_perStepMR);
    if(_ssTimeAtCap>0){_ssMR=Math.min(10,Math.round(applyDurationPenalty(_ssMR,_ssTimeAtCap)*10)/10);}
    // Descent diagnostic: compare summit step vs final step
    var _summitSi=0;for(var _dsi=1;_dsi<_perStepMR.length;_dsi++){if(_perStepMR[_dsi]>_perStepMR[_summitSi])_summitSi=_dsi;}
    var _lastSi=_perStepMR.length-1;
    // Recompute local conditions at summit and final steps for diagnostic
    var _diagSummitElev=_ep&&_summitSi<_ep.length?_ep[_summitSi].elev:_baseElev;
    var _diagLastElev=_ep&&_lastSi<_ep.length?_ep[_lastSi].elev:_baseElev;
    var _diagSummitTemp=tempF+elevTempAdj(_diagSummitElev-(_ep?_ep[0].elev:_baseElev));
    var _diagLastTemp=tempF+elevTempAdj(_diagLastElev-(_ep?_ep[0].elev:_baseElev));
    var _diagSummitRH=_dpC!=null?calcElevationHumidity((_diagSummitTemp-32)*5/9,_dpC):humidity;
    var _diagLastRH=_dpC!=null?calcElevationHumidity((_diagLastTemp-32)*5/9,_dpC):humidity;
    var _diagSummitVpd=vpdRatio(_diagSummitTemp,_diagSummitRH);
    var _diagLastVpd=vpdRatio(_diagLastTemp,_diagLastRH);
    var _diagSummitDesc=_summitSi>0&&_ep&&_ep[_summitSi].elev<_ep[_summitSi-1].elev;
    var _diagLastDesc=_lastSi>0&&_ep&&_ep[_lastSi].elev<_ep[_lastSi-1].elev;
    console.log('[PHY039B] TRAIL DEBUG:',JSON.stringify({totalDist:Math.round(_totalDist*100)/100,dur:durationHrs,steps:_perStepMR.length,lastStepDist:Math.round((_perStepDist[_lastSi]||0)*100)/100,tripStyle:_tripStyle,rawPts:_epGrade?_epGrade.length:0,mirroredPts:_ep?_ep.length:0,peakMR:_perStepMR[_summitSi],endMR:_perStepMR[_lastSi],sessionMR:_ssMR,cap:Math.round(_ssCap*1000)/1000,summit:{idx:_summitSi,elev:Math.round(_diagSummitElev),temp:Math.round(_diagSummitTemp*10)/10,rh:Math.round(_diagSummitRH),vpd:Math.round(_diagSummitVpd*1000)/1000,isDesc:_diagSummitDesc,mr:_perStepMR[_summitSi],trapped:Math.round(_perStepTrapped[_summitSi]*10000)/10000},final:{idx:_lastSi,elev:Math.round(_diagLastElev),temp:Math.round(_diagLastTemp*10)/10,rh:Math.round(_diagLastRH),vpd:Math.round(_diagLastVpd*1000)/1000,isDesc:_diagLastDesc,mr:_perStepMR[_lastSi],trapped:Math.round(_perStepTrapped[_lastSi]*10000)/10000}}));
    return{trapped:_ssTrapped,sessionMR:_ssMR,timeAtCapHrs:_ssTimeAtCap,layerSat:null,perCycleTrapped:null,perCycleMR:null,perCycleWetPenalty:null,fatigue:0,perCycleFatigue:null,perPhaseMR:null,perPhaseHL:null,perStepMR:_perStepMR,perStepDist:_perStepDist,perStepElev:_perStepElev,perStepTrapped:_perStepTrapped};
  }
  // BC skiing: override phase percentages when vertical gain is provided
  // Descent rate: steep/technical terrain = 3000 ft/hr, standard = 4000 ft/hr
  if(profileKey==="skiing_bc"&&bcVerticalGainFt&&bcVerticalGainFt>0){
    const descentRate=snowTerrain==="backcountry"?4000:3000; // standard BC vs steep
    const phasePcts=calcBCPhasePercentages(bcVerticalGainFt,descentRate);
    if(phasePcts){
      profile={type:"linear",phases:[
        {name:"skinning",pct:phasePcts.skinning,intensity:"very_high",windType:"walking",canVent:true},
        {name:"transition",pct:phasePcts.transition,intensity:"low",windType:"ridge",canVent:true},
        {name:"descent",pct:phasePcts.descent,intensity:"high",windType:"speed",canVent:false},
      ]};
    }
  }
  const totalMin=durationHrs*60;
  const sweatProfile=ACTIVITY_SWEAT_PROFILES[activity]||ACTIVITY_SWEAT_PROFILES.hiking;
  // PHY-052: split-body im when wading — 45% upper (normal im) + 55% lower (wader im)
  var _ppIsSnow=activity==='skiing'||activity==='snowboarding';
  var _effectiveIm=waderType&&activity==='fishing'&&fishWading?waderSplitIm(ensembleIm,waderType):_ppIsSnow?snowSportSplitIm(ensembleIm):ensembleIm;
  const imFactor=_effectiveIm?(_effectiveIm/BASELINE_IM):1.0;
  // PHY-032 / BUG-086: use actual intensity for CLO (was hardcoded "moderate")
  // PHY-033: evapPenalty (CLO-based) removed — imFactor above is the sole fabric permeability term
  const cloFactor=clothingInsulation(tempF,effInt||"moderate");
  const drysuitEvapBlock=isDrysuit?0.15:1.0;
  const dryAirBonus=humidity<20?1.8:humidity<30?1.4:humidity<40?1.15:1.0;
  // Continuous sweat rate for a given intensity (no intermittency factor, no golfCart reduction)
  // All environmental multipliers applied; phase-specific intensity drives base rate
  // PHY-032 Addendum: phaseDurMin + phaseName enable thermal time constant scaling
  const phaseSweatRate=(phaseInt,phaseDurMin,phaseName)=>{
    const base=sweatProfile[phaseInt]||sweatProfile.moderate;
    const effectiveTemp=isDrysuit?Math.max(tempF,Math.min(80,tempF+30)):tempF;
    const rawTempMul=effectiveTemp>80?1.5:effectiveTemp>65?1.0:effectiveTemp>45?0.6:effectiveTemp>30?0.35:0.2;
    // intTempFloor removed (PHY-001 audit) — f_e handles microclimate heating
    const tempMul=rawTempMul;
    const humMul=1+(Math.max(humidity-40,0)/100)*0.8;
    const sexMul=(sex==="female")?0.75:1.0;
    const wt=weightLb||150;
    const wtMul=0.6+(wt/170)*0.4;
    var _fitSweat=fitnessProfile?fitnessProfile.sweatMul:1.0;
    // ECO-001: VO2-based metabolic efficiency for intermittent phases
    var _metEff=1.0;
    if(fitnessProfile&&(fitnessProfile.vo2max||fitnessProfile.restingHR)){
      var _metMap={low:3,moderate:5,high:7,very_high:9};
      _metEff=getMetabolicEfficiency(_metMap[phaseInt]||5,fitnessProfile.vo2max,null,sex,fitnessProfile.restingHR);
      _fitSweat=1.0;
    }
    // BUG-086 + Addendum: per-phase CLO with thermal time constant scaling
    // Lift/rest phases: f_e=1.0 (no CLO feedback when stationary)
    // Run phases: f_e scaled by phase_ratio = min(1.0, durMin/TAU_CLOTHING)
    // Sustained phases (>TAU): full f_e (phase_ratio=1.0)
    var phaseClo;
    if(phaseName==="lift"||phaseName==="wait"||phaseName==="rest"){
      phaseClo=1.0; // stationary: no metabolic heat trapping
    } else {
      var feF=clothingInsulation(tempF,phaseInt); // f_e_full (steady-state)
      var phaseR=Math.min(1.0,(phaseDurMin||120)/TAU_CLOTHING); // phase_ratio
      phaseClo=1.0+(feF-1.0)*phaseR; // f_e_phase (scaled)
    }
    return base*tempMul*phaseClo*humMul*sexMul*wtMul*sweatProfile.coverageMul*(paceMul||1.0)*(packLoadMul||1.0)*_fitSweat*_metEff;
  };
  // Phase-specific wind for evaporation calculation
  const getPhaseWind=(windType)=>{
    // PHY-019: Variant-aware skiing descent wind — W_run = W_ambient + V_descent * f_turn
    if(windType==="skiing_descent"){var _dw=descentSpeedWind(profileKey);return windMph+_dw.speed*_dw.turnFactor;}
    if(windType==="speed")return Math.max(windMph,25); // cycling speed (skiing now uses skiing_descent)
    if(windType==="headwind_low")return Math.max(windMph,8); // cycling climb at 6-8 mph
    if(windType==="cycling_speed")return Math.max(windMph,15); // cycling flat at 12-16 mph
    if(windType==="descent_speed")return Math.max(windMph,30); // cycling descent at 25-40 mph
    if(windType==="cart")return windMph+5; // golf cart adds ~5 mph
    if(windType==="kayak")return windMph+3; // kayak forward motion
    if(windType==="walking")return Math.max(windMph,3); // skinning pace minimum
    if(windType==="ridge")return Math.max(windMph,windMph*1.3); // exposed ridge amplifies
    if(windType==="calm")return Math.max(2,windMph*0.5); // sheltered
    return windMph; // ambient
  };
  // Per-phase independent evaporation + cycle-level saturation drain
  // Physics: each phase's evaporation acts on that phase's OWN production (evapRate was
  // calibrated as a dimensionless fraction of per-phase output). Cross-cycle accumulation
  // is tracked separately — fabric saturation (Havenith 2002: ~180g for merino base)
  // limits how much the base layer holds. Excess beyond capacity partially drains per
  // cycle via gravity wicking and outward moisture migration.
  let netTrapped=0;
  var _totalTimeAtCapHrs=0; // PHY-028b: track time at saturation cap for duration penalty
  // PHY-028c: per-layer caps — system capacity = sum of layer caps
  // PHY-038 A5: activity-specific ensemble capacity (2-layer fishing=0.26L, 4-layer skiing=0.42L)
  var _systemCap=getEnsembleCapacity(activity);
  if(profile.type==="cyclic"){
    const cycleDur=profile.phases.reduce((s,p)=>s+p.durMin,0);
    // PHY-031: cycleOverride provides externally-computed cycle count (crowd calendar + component cycle)
    // When null, fall back to original totalMin/cycleDur calculation (backward compatible)
    const _useOverride=cycleOverride&&typeof cycleOverride.totalCycles==="number";
    const totalCycles=_useOverride?cycleOverride.totalCycles+(cycleOverride.totalCycles%1===0?0.25:0):totalMin/cycleDur;
    var wholeCycles=_useOverride?cycleOverride.totalCycles:Math.floor(totalCycles);
    const fracCycle=totalCycles-wholeCycles;
    // PHY-040 RECONNECT: Extract elevation data from cycleOverride
    var _elevFt=cycleOverride&&cycleOverride.elevFt?cycleOverride.elevFt:0;
    var _perRunVert=cycleOverride&&cycleOverride.perRunVertFt?cycleOverride.perRunVertFt:1000;
    var _dewPointC=cycleOverride&&typeof cycleOverride.dewPointC==='number'?cycleOverride.dewPointC:null;
    // RECONNECT 2: Adjust humidity for altitude via dew point (Magnus formula)
    var _adjHumidity=humidity;
    if(_dewPointC!==null&&_elevFt>1000){
      var _tempC_h=(tempF-32)*5/9;
      _adjHumidity=calcElevationHumidity(_tempC_h,_dewPointC);
    }
    // RECONNECT 3: Altitude evaporation — lower air pressure increases evap rate
    var _altEvap=altitudeFactors(_elevFt).evap;
    // RECONNECT 4: Altitude convection — thinner air reduces boundary layer stripping
    var _altConv=altitudeFactors(_elevFt).convective;
    // Pre-compute per-phase production, evaporation, and NET retained moisture
    // PHY-038 A3: Phase-specific evaporation asymmetry
    // Run: body heat (750W) drives vapor outward + movement pumps air through layers + speed wind
    // Lift: sitting still (120W), no bellows, no speed wind — im effectiveness reduced
    // PHY-041: resolve shell wind resistance for wind penetration factor
    var _cSwr=shellWindRes!=null?shellWindRes:GENERIC_GEAR_SCORES_BY_SLOT.shell.windResist;
    const phaseData=profile.phases.map(phase=>{
      const sr=phaseSweatRate(phase.intensity,phase.durMin,phase.name);
      const produced=sr*(phase.durMin/60)/1000; // liters per full phase
      const phaseWind=getPhaseWind(phase.windType);
      var _isActive=(phase.name!=="lift"&&phase.name!=="wait"&&phase.name!=="rest");
      // PHY-039: ventedMul sealed penalties removed (0.70/0.25 were pre-PHY-033 artifacts).
      // im_ensemble (via imFactor) handles sealed-state vapor transport — Woodcock index.
      // Vent bypass (1.6×) kept: open zippers create convective bypass im doesn't capture.
      const ventedMul=phase.canVent?1.6:1.0;
      // PHY-041: wind penetration through shell — venting halves effective wind resistance
      var _phVentWR=phase.canVent?_cSwr*0.5:_cSwr;
      var _phVEvap=V_BOUNDARY+phaseWind*getWindPenetration(_phVentWR);
      var _phVpd=vpdRatio(tempF,_adjHumidity);
      var _phRawEvap=(_phVEvap/20)*_phVpd*ventedMul*imFactor*drysuitEvapBlock*dryAirBonus*_altEvap;
      const evapRate=waderEvapFloor(_phRawEvap,humidity,waderType,fishWading);
      // Per-phase independent: evaporation removes fraction of THIS phase's production only
      const evaporated=Math.min(produced,evapRate*produced);
      const retained=Math.max(MIN_RETAINED/profile.phases.length,produced-evaporated);
      // PHY-043: store f_e_full and TAU ramp for microState carry-forward scaling
      var _phFeF=_isActive?clothingInsulation(tempF,phase.intensity):1.0;
      var _phTauR=_isActive?Math.min(1.0,(phase.durMin||120)/TAU_CLOTHING):0;
      return {produced,evapRate,retained,durMin:phase.durMin,_feF:_phFeF,_tauRamp:_phTauR};
    });
    // Per-cycle net = total moisture retained across all phases in one cycle
    // PHY-032: hygroscopic absorption — ambient vapor absorbed by fabric per cycle
    const _aHygro=hygroAbsorption(tempF,humidity,ensembleIm,DEFAULT_REGAIN);
    const cycleNet=phaseData.reduce((s,pd)=>s+pd.retained,0)+_aHygro;
    // Iterate across cycles: accumulate moisture, apply surface-evaporation drain
    let cumMoisture=initialTrapped||0; // Trip Builder: carry-forward from previous segment
    let _cyclesAtCap=0; // PHY-028b: track time at saturation cap
    var _perCycleTrapped=[]; // DATA-FLOW: per-cycle snapshot for display components
    var _perCycleMR=[]; // DATA-FLOW: full MR score per cycle (same formula as badge)
    var _perCycleHL=[]; // DATA-FLOW: per-cycle heat loss with wetness+fatigue penalty
    // Per-PHASE data: two entries per cycle (run trapped, lift trapped) for sawtooth chart
    var _perPhaseMR=[]; // [{phase:'run',cycle:0,mr:X},{phase:'lift',cycle:0,mr:X},...]
    var _perPhaseHL=[];
    // PHY-034: Conductivity fatigue accumulator
    var _fatigue=0;
    var _perCycleFatigue=[];
    // ============================================================
    // LC5 ENERGY BALANCE ENGINE — replaces S0 × multiplier tables
    // ============================================================
    var _TambC=(tempF-32)*5/9;
    var _windMs=windMph*0.44704;
    var _bodyFatPct=fitnessProfile&&fitnessProfile.bodyFatPct?fitnessProfile.bodyFatPct:20;
    var _tissueCLO=computeTissueCLO(_bodyFatPct);
    var _Rtissue=_tissueCLO*0.155;
    var _totalCLO=(totalCLOoverride!=null&&totalCLOoverride>0)?totalCLOoverride:activityCLO(activity);
    // PHY-049: Gear-derived baseCLO (replaces fixed activity lookup for thermal resistance)
    var _gearCLO=null;
    if(gearItems&&gearItems.length>0){
      _gearCLO=0;
      for(var _gi=0;_gi<gearItems.length;_gi++){
        if(gearItems[_gi]&&typeof gearItems[_gi].warmthRatio==='number'){
          _gearCLO+=warmthToCLO(gearItems[_gi].warmthRatio);
        }
      }
    }
    var _baseCLO=Math.max(0.3,Math.min(4.0,_gearCLO||_totalCLO));
    // PHY-049: Extract shell wind resistance from outermost gear layer
    var _phy049ShellWR=0;
    if(gearItems&&gearItems.length>0){
      var _outerGear=gearItems[gearItems.length-1];
      _phy049ShellWR=(_outerGear&&(_outerGear.windResist||0))||0;
    }
    if(_phy049ShellWR===0&&shellWindRes!=null){_phy049ShellWR=shellWindRes;}
    var _lc5Mets={low:1.5,moderate:5,high:8,very_high:10};
    var _METrun=_lc5Mets[profile.phases[0].intensity]||5;
    var _METlift=profile.phases.length>1?(_lc5Mets[profile.phases[1].intensity]||1.5):1.5;
    var _epocTauVal=epocTau(_METrun); // legacy single-tau (CLO floor etc.)
    var _dMET=_METrun-_METlift;
    // PHY-046: Two-component EPOC (Børsheim & Bahr 2003)
    var _epoc=epocParams(_METrun,_METlift);
    // Speed wind for skiing descent (m/s)
    var _speedWindMs=0;
    if(isSki&&profileKey){
      var _dsw=descentSpeedWind(profileKey);
      _speedWindMs=_dsw.speed*_dsw.turnFactor*0.44704;
    }
    var _faceCover='none'; // MVP default
    var _cumStorageWmin=0;
    // STEP 2: per-cycle heat storage tracking for active heat balance reporting
    var _perCycleHeatStorage=[];
    var _peakCycleHeatBalanceW=0;
    var _peakCycleHeatBalanceDirection='neutral';
    var _peakCycleHeatBalanceIdx=-1;
    var _runMin=profile.phases[0].durMin;
    var _liftMin=profile.phases.length>1?profile.phases[1].durMin:0;
    var _humFrac=humidity/100; // convert 0-100 → 0-1 for respiratory calcs
    // LC5 new per-cycle tracking arrays
    var _perCycleCoreTemp=[];
    var _perCycleCIVD=[];
    var _totalFluidLoss=0;
    var _perCycleTSkin=[];
    var _goodRunCount=0;
    var _yellowRunCount=0; // MR 2.5–4.0: manageable but monitor
    // PHY-048: Per-layer moisture buffer initialization
    // PHY-048: gearItems passed directly as parameter (no window global)
    var _resolvedGear=gearItems||null;
    // isStrategyPill: when CLO is overridden (strategy winner) and no specific gear passed
    var _isStratPill=!_resolvedGear&&totalCLOoverride!=null;
    // Multi-segment: use initialLayers if provided (buffer state from previous segment)
    var _layers;
    if(initialLayers&&Array.isArray(initialLayers)&&initialLayers.length>0){
      // Deep copy so we don't mutate the caller's array
      _layers=initialLayers.map(function(l){return{im:l.im,cap:l.cap,buffer:l.buffer||0,wicking:l.wicking,fiber:l.fiber,name:l.name};});
    } else {
      _layers=buildLayerArray(_resolvedGear,activity,_totalCLO,_isStratPill);
    }
    // BUG-139: Override default layer ims with strategy winner's actual values
    // Strategy engine computes per-layer ims from real product breathability
    // buildLayerArray defaults (shell im=0.12) don't reflect the strategy winner
    if(_isStratPill&&cycleOverride&&cycleOverride.strategyLayerIms){
      var _slotMap={};
      cycleOverride.strategyLayerIms.forEach(function(l){_slotMap[l.slot]=l.im;});
      // Map layer positions to slots based on layer count
      var _slotOrder=_layers.length===4?['base','mid','insulative','shell']
        :_layers.length===3?['base','mid','shell']
        :_layers.length===2?['base','shell']
        :['base'];
      for(var _soi=0;_soi<Math.min(_layers.length,_slotOrder.length);_soi++){
        if(_slotMap[_slotOrder[_soi]]){
          _layers[_soi].im=_slotMap[_slotOrder[_soi]];
        }
      }
    }
    var _systemCapLayers=_layers.reduce(function(s,l){return s+l.cap;},0);
    // Use per-layer system cap for MR denominator (replaces getEnsembleCapacity for cyclic path)
    _systemCap=Math.max(_systemCap,_systemCapLayers/1000); // keep whichever is larger (backward compat)
    // Distribute initial trapped moisture into base layer (legacy scalar carry-forward)
    if(!initialLayers&&initialTrapped>0&&_layers.length>0){_layers[0].buffer=Math.min(initialTrapped*1000,_layers[0].cap);}
    // Warmup phase: first 15% of cycles at groomer METs (~5.0)
    // Standard ski instruction: 2-3 groomed warmup runs before high-intensity terrain
    // Only applies to resort skiing/snowboarding — hiking starts at hiking MET immediately
    var _hasWarmup=isSki;
    var _warmupCycles=_hasWarmup?Math.max(1,Math.round(wholeCycles*0.15)):0;
    var _groomerMET=5.0; // moderate groomers intensity
    for(let c=0;c<wholeCycles;c++){
      var _isWarmup=(c<_warmupCycles);
      var _cycleMET=_isWarmup?_groomerMET:_METrun;
      var _cycleSpeedWMs=_isWarmup?(_speedWindMs*0.6):_speedWindMs; // warmup = slower, ~60% speed
      var sat=Math.min(1,cumMoisture/_systemCap);
      // CLO degradation from wetness — 40% loss at full saturation
      var _cloDeg=1.0-sat*0.4;
      var _Rclo=_totalCLO*0.155*_cloDeg;
      // PHY-049: Dynamic CLO for HLR scoring (does NOT feed moisture/sweat model)
      var _runCLOdyn=computeEffectiveCLO(_baseCLO,_cycleMET,_phy049ShellWR,windMph,_layers.length);
      var coreTemp=estimateCoreTemp(LC5_T_CORE_BASE,_cumStorageWmin,_bodyMassKg);
      // === RUN PHASE: Energy Balance ===
      var _hcRun=8.3*Math.sqrt(Math.max(0.5,_windMs+_cycleSpeedWMs));
      var _RaRun=1/_hcRun;
      var _iterRun=iterativeTSkin(coreTemp,_TambC,_Rtissue,_Rclo,_RaRun,_bsa,_cycleMET,_windMs+_cycleSpeedWMs,_humFrac*100,_effectiveIm||0.089,_bodyFatPct,8,0.1);
      var _TskRun=_iterRun.T_skin;
      var _Qmet=computeMetabolicHeat(_cycleMET,_bodyMassKg);
      // Option A: Rtissue in computeTSkin lowers Tsk; convective uses Rclo+Rair only
      var _QconvRun=computeConvectiveHeatLoss(_TskRun,_TambC,_Rclo,_bsa,_windMs,_speedWindMs);
      var _TsurfRun=_TskRun-(_TskRun-_TambC)*(_Rclo/(_Rclo+_RaRun));
      var _QradRun=computeRadiativeHeatLoss(_TsurfRun,_TambC,_bsa);
      var _respRun=computeRespiratoryHeatLoss(_cycleMET,_TambC,_humFrac,_bodyMassKg,_faceCover);
      var _QpassRun=_QconvRun+_QradRun+_respRun.total+7; // 7W insensible
      var _residRun=_Qmet-_QpassRun;
      // PHY-046: Coupled sweat model — E_req vs E_max determines regime
      var _eReqRun=Math.max(0,_residRun); // energy balance residual = required evaporative cooling
      var _emaxRun=computeEmax(_TskRun,_TambC,_humFrac*100,_windMs+_cycleSpeedWMs,_effectiveIm||0.089,_totalCLO,_bsa);
      var _srRun=computeSweatRate(_eReqRun,_emaxRun.eMax);
      var _sweatRateRunGhr=_srRun.sweatGPerHr;
      var _sweatRunG=_sweatRateRunGhr*(_runMin/60); // grams this phase
      // Heat storage: compensable = evap handles it (qEvapW credited). Deficit = cooling.
      var _runNetHeat=_residRun-_srRun.qEvapW; // net after evaporative cooling
      var _runStorage=_runNetHeat*_runMin; // W·min (positive = heating, negative = cooling)
      // === LIFT PHASE: Sub-stepped with EPOC decay (1-min increments) ===
      // Per-cycle EPOC from this cycle's actual MET (warmup uses groomer MET)
      var _cycleEpoc=epocParams(_cycleMET,_METlift);
      var _sweatLiftG=0,_liftCondensG=0,_liftExcessG=0,_liftStorage=0,_eolDeficit=0;
      for(var mn=0;mn<_liftMin;mn++){
        var _t=mn+0.5;
        // Two-component EPOC: fast (τ=3-5min) + slow (τ=30-45min)
        var _METnow=_METlift+_cycleEpoc.aFast*Math.exp(-_t/_cycleEpoc.tauFast)+_cycleEpoc.aSlow*Math.exp(-_t/_cycleEpoc.tauSlow);
        var _shiv=shiveringBoost(_TambC,_METnow,_totalCLO+_tissueCLO,_bodyFatPct);
        var _METeff=_METnow; // shivering is failure mode, not credited in energy balance (CLO floor handles rejection)
        var _hcL=8.3*Math.sqrt(Math.max(0.5,_windMs));
        var _RaL=1/_hcL;
        var _iterL=iterativeTSkin(coreTemp,_TambC,_Rtissue,_Rclo,_RaL,_bsa,_METnow,_windMs,_humFrac*100,_effectiveIm||0.089,_bodyFatPct,6,0.1);
        var _TskL=_iterL.T_skin;
        var _QmL=computeMetabolicHeat(_METeff,_bodyMassKg);
        var _QcL=computeConvectiveHeatLoss(_TskL,_TambC,_Rclo,_bsa,_windMs,0);
        var _TsL=_TskL-(_TskL-_TambC)*(_Rclo/(_Rclo+_RaL));
        var _QrL=computeRadiativeHeatLoss(_TsL,_TambC,_bsa);
        var _respL=computeRespiratoryHeatLoss(_METeff,_TambC,_humFrac,_bodyMassKg,_faceCover);
        var _QpL=_QcL+_QrL+_respL.total+7;
        var _resL=_QmL-_QpL;
        // PHY-046: Coupled model for lift phase too
        var _eReqL=Math.max(0,_resL);
        var _emaxL=computeEmax(_TskL,_TambC,_humFrac*100,_windMs,_effectiveIm||0.089,_totalCLO,_bsa);
        var _srL=computeSweatRate(_eReqL,_emaxL.eMax);
        _sweatLiftG+=_srL.sweatGPerHr*(1/60); // g this minute (total production for tracking)
        // Condensation model: same physics as run phase — vapor exit vs surface pass
        var _liftVaporMin=Math.min(_srL.sweatGPerHr,(_emaxL.eMax/LC5_L_V)*3600)/60;
        var _liftSurfMin=_surfacePassHr/60; // reuse run-phase surface rate (ambient wind, same CLO)
        _liftCondensG+=Math.max(0,_liftVaporMin-_liftSurfMin);
        _liftExcessG+=Math.max(0,_srL.sweatGPerHr/60-_liftVaporMin);
        // Net heat after evap: deficit = cooling, surplus = core heating
        var _liftNetHeat=_resL-_srL.qEvapW;
        _liftStorage+=_liftNetHeat*1; // W·min
        if(mn===_liftMin-1)_eolDeficit=_liftNetHeat; // end-of-lift (after evap credit)
      }
      _cumStorageWmin+=_runStorage+_liftStorage;
      // STEP 2: capture per-cycle storage in W (convert from W·min to average W over the cycle)
      var _cycleTotalWmin=_runStorage+_liftStorage;
      var _cycleTotalMin=_runMin+_liftMin;
      var _cycleAvgW=_cycleTotalMin>0?_cycleTotalWmin/_cycleTotalMin:0;
      _perCycleHeatStorage.push(Math.round(_cycleAvgW*10)/10);
      if(Math.abs(_cycleAvgW)>Math.abs(_peakCycleHeatBalanceW)){
        _peakCycleHeatBalanceW=_cycleAvgW;
        _peakCycleHeatBalanceDirection=_cycleAvgW>0?'hot':_cycleAvgW<0?'cold':'neutral';
        _peakCycleHeatBalanceIdx=_perCycleHeatStorage.length-1;
      }
      // ============================================================
      // PHY-048: PER-LAYER MOISTURE BUFFER
      // Sweat enters layer[0], wicks outward, drains from surface
      // ============================================================
      var _insensibleG=10*(_runMin+_liftMin)/60; // g/cycle (10 g/hr, Jeje & Koon 1989)
      var _runProdG=_srRun.sweatGPerHr*(_runMin/60); // total run sweat (grams)
      var _liftProdG=_sweatLiftG; // total lift sweat from sub-step loop
      var _cycleProdG=_runProdG+_liftProdG+_insensibleG;
      _totalFluidLoss+=_cycleProdG+_respRun.moistureGhr*(_runMin/60);
      var _cycleMin=_runMin+_liftMin;

      var _outerL=_layers[_layers.length-1]; // hoist for condensation + drain
      // === PRODUCTION: Condensation inflow (Yoo & Kim 2008) ===
      // Vapor throughput: what CAN evaporate at skin and pass through clothing
      var _vaporExitHr=Math.min(_srRun.sweatGPerHr,(_emaxRun.eMax/LC5_L_V)*3600);
      // Surface pass rate: what exits at outer surface (getDrainRate, PHY-047)
      var _surfacePassHr=getDrainRate(tempF,humidity,windMph,_outerL.im,_totalCLO,_bsa);
      // Condensation: vapor enters clothing but can't exit at surface → condenses at mid-layers
      var _condensHr=Math.max(0,_vaporExitHr-_surfacePassHr);
      // Uncompensable excess: sweat beyond what evaporates at skin
      var _excessHr=Math.max(0,_srRun.sweatGPerHr-_vaporExitHr);
      // Temperature-dependent condensation retention (Yoo & Kim 2008 + thermal gradient)
      // Condensation severity depends on how much of the clothing stack is below dew point.
      // T_dew at skin ~29°C (30°C skin, ~95% RH from sweat). T_mid = midpoint of CLO stack.
      // Severity = fraction of stack below dew point. Retention = 0.40 × severity.
      // 0.40 upper bound from Yoo & Kim Fig 10, Array A, −15°C steady state (39% → 0.40).
      var _tSkinRetC=30; // insulated torso skin temp
      var _tDewMicro=29; // dew point at skin (~30°C, ~95% local RH)
      // CLO-dependent midpoint: lower CLO = warmer midpoint = less condensation
      // T_mid = T_amb + (T_skin - T_amb) × R_half / R_total (ISO 7730 linear profile)
      var _RcloHalf=_totalCLO*0.155*0.5;
      var _RairCond=1/(8.3*Math.sqrt(Math.max(0.5,_windMs)));
      var _midFrac=(_totalCLO>0)?_RcloHalf/(_totalCLO*0.155+_RairCond):0.5;
      var _tMidC=_TambC+(_tSkinRetC-_TambC)*_midFrac;
      var _condensSeverity=Math.max(0,(_tDewMicro-_tMidC)/_tDewMicro);
      var _netRetention=0.40*_condensSeverity;
      var _retainedCondensG=_condensHr*_netRetention;
      // Fabric buffer receives retained condensation + excess (run + lift) + insensible
      // Lift condensation gets same 35% retention (Yoo & Kim applies to full clothing system)
      var _liftRetainedG=_liftCondensG*_netRetention+_liftExcessG*_netRetention;
      // NaN guard: if lift condensation produced NaN (e.g. _surfacePassHr undefined on first cycle), fall back
      var _liftFabricG=isNaN(_liftRetainedG)?_liftProdG*0.35:_liftRetainedG;
      var _fabricInG=(_retainedCondensG+_excessHr*_netRetention)*(_runMin/60)+_liftFabricG+_insensibleG;
      // === CONDENSATION PLACEMENT: deposit at thermal boundary, not base ===
      // Temperature drops linearly through CLO stack (ISO 7730).
      // Condensation deposits where T_local < T_dew (~29°C at skin).
      // Weight by undershoot: colder layers get more condensation (Yoo & Kim 2008 Fig 11).
      var _tSkinC=_TskRun; // computed skin temp from energy balance
      var _Rtotal=_totalCLO*0.155+(1/_hcRun);
      var _Rcum=0;
      var _condensWeights=[];
      var _cwSum=0;
      for(var _cwi=0;_cwi<_layers.length;_cwi++){
        var _layerCLO=_totalCLO/_layers.length;
        _Rcum+=_layerCLO*0.155;
        var _tLayerC=_tSkinC-(_tSkinC-_TambC)*(_Rcum/_Rtotal);
        var _undershoot=Math.max(0,_tDewMicro-_tLayerC);
        _condensWeights.push(_undershoot);
        _cwSum+=_undershoot;
      }
      if(_cwSum>0){for(var _cwi=0;_cwi<_condensWeights.length;_cwi++){_condensWeights[_cwi]/=_cwSum;}}
      else{_condensWeights[_condensWeights.length-1]=1.0;} // all to shell if no undershoot
      // Distribute condensation across layers by thermal gradient weight
      for(var _di=0;_di<_layers.length;_di++){
        _layers[_di].buffer+=_fabricInG*_condensWeights[_di];
      }

      // === OVERFLOW CASCADE INWARD: shell → insulation → mid → base ===
      // When outer layers saturate, excess migrates inward through capillary contact (Yoo & Kim)
      for(var _oi=_layers.length-1;_oi>0;_oi--){
        var _overflow=Math.max(0,_layers[_oi].buffer-_layers[_oi].cap);
        if(_overflow>0){_layers[_oi].buffer=_layers[_oi].cap;_layers[_oi-1].buffer+=_overflow;}
      }
      // Base layer overflow = liquid on skin, nowhere to go
      _layers[0].buffer=Math.min(_layers[0].buffer,_layers[0].cap);
      // === BIDIRECTIONAL WICKING: moisture moves from wetter to drier neighbor ===
      // Washburn 1921 capillary kinetics + Courant stability (×0.5 prevents oscillation)
      for(var _li=0;_li<_layers.length-1;_li++){
        var _fillI=_layers[_li].cap>0?_layers[_li].buffer/_layers[_li].cap:0;
        var _fillJ=_layers[_li+1].cap>0?_layers[_li+1].buffer/_layers[_li+1].cap:0;
        if(_fillI>_fillJ){
          // Outward wicking (base → shell)
          var _wickR=(_layers[_li].wicking||7)/10;
          var _retFrac=Math.pow(Math.max(0,1-_wickR),_cycleMin);
          var _delta=(_fillI-_fillJ)*_layers[_li].cap*(1-_retFrac)*0.5;
          _delta=Math.min(_delta,_layers[_li].buffer,Math.max(0,_layers[_li+1].cap-_layers[_li+1].buffer));
          _layers[_li].buffer-=_delta;
          _layers[_li+1].buffer+=_delta;
        } else if(_fillJ>_fillI){
          // Inward wicking (condensation migrating toward skin)
          var _wickR=(_layers[_li+1].wicking||7)/10;
          var _retFrac=Math.pow(Math.max(0,1-_wickR),_cycleMin);
          var _delta=(_fillJ-_fillI)*_layers[_li+1].cap*(1-_retFrac)*0.5;
          _delta=Math.min(_delta,_layers[_li+1].buffer,Math.max(0,_layers[_li].cap-_layers[_li].buffer));
          _layers[_li+1].buffer-=_delta;
          _layers[_li].buffer+=_delta;
        }
      }

      // BUG-133: Snapshot pre-drain layer buffers for run-phase MR (sawtooth peak).
      // After fabric inflow + cascade + wicking, but BEFORE surface drain,
      // the buffers reflect run-phase sweat accumulation — the sawtooth peak.
      // Save per-layer buffer state for computePerceivedMR (skin-adjacent weighting).
      var _preDrainBufs=[];
      for(var _pdi=0;_pdi<_layers.length;_pdi++){_preDrainBufs.push(_layers[_pdi].buffer);}

      // === SURFACE DRAIN: outermost layer evaporates to air (PHY-047) ===
      // === SURFACE DRAIN: phase-weighted (run wind vs lift wind) ===
      var _outerFill=Math.min(1,_outerL.buffer/_outerL.cap);
      // Run phase: rider speed adds apparent wind (vector avg ×0.5 for random wind direction)
      var _riderSpeedMph=(_cycleSpeedWMs||0)/0.447; // convert m/s back to mph
      var _effectiveWindRun=windMph+_riderSpeedMph*0.5;
      var _runDrainHr=getDrainRate(tempF,humidity,_effectiveWindRun,_outerL.im,_totalCLO,_bsa);
      // Lift phase: ambient wind only (rider stationary)
      var _liftDrainHr=getDrainRate(tempF,humidity,windMph,_outerL.im,_totalCLO,_bsa);
      // Time-weighted average across cycle
      var _drainGPerHr=(_runDrainHr*_runMin+_liftDrainHr*_liftMin)/_cycleMin;
      var _drainG=_drainGPerHr*(_cycleMin/60)*_outerFill; // Schlünder 1988 wetted fraction
      _drainG=Math.min(_drainG,_outerL.buffer);
      _outerL.buffer-=_drainG;

      // === VENT EVENTS: reduce ALL layers ===
      if(ventEvents&&ventEvents.length>0){
        var _realCycMin=totalMin/Math.max(1,wholeCycles+(fracCycle>0?fracCycle:0));
        var _cycStartMin=c*_realCycMin;
        var _cycEndMin=_cycStartMin+_realCycMin;
        var _bestVentEff=0;
        for(var _vi=0;_vi<ventEvents.length;_vi++){
          var _ve=ventEvents[_vi];
          var _veTime=typeof _ve==='number'?_ve:_ve.time;
          var _veType=typeof _ve==='object'?_ve.type:'vent';
          if(_veTime>=_cycStartMin&&_veTime<_cycEndMin){
            var _thisEff;
            if(_veType==='lodge'){_thisEff=0.85;}
            else{
              var _ventCold=tempF<40?Math.max(0.4,1-(40-tempF)/80):1;
              var _ventHum=humidity>80?0.7:humidity>60?0.85:1.0;
              _thisEff=0.6*_ventCold*_ventHum;
            }
            _bestVentEff=Math.max(_bestVentEff,_thisEff);
          }
        }
        if(_bestVentEff>0){
          // PHY-048: Physics-based vent model — pit zips expose 15% of torso to direct air
          // Vented area bypasses shell, uses base layer im directly (ISO 9920)
          var _ventArea=0.15; // two pit zips, ~7-8% each (garment construction)
          var _ventBaseIm=(_layers.length>0?_layers[0].im:0.40)||0.40;
          var _ventCLOval=0.3; // base layer only, no shell/mid (ISO 9920 single layer)
          var _ventedDrainHr=getDrainRate(tempF,humidity,windMph,_ventBaseIm,_ventCLOval,_bsa*_ventArea);
          // Vent events last ~5 minutes (typical pit-zip duration during lift)
          var _ventDurMin=5;
          var _ventDrainG=_ventedDrainHr*(_ventDurMin/60);
          // Apply extra drain to each layer proportionally
          var _ventTotalBuf=0;
          for(var _vli=0;_vli<_layers.length;_vli++){_ventTotalBuf+=_layers[_vli].buffer;}
          if(_ventTotalBuf>0){
            for(var _vli=0;_vli<_layers.length;_vli++){
              var _ventShare=_layers[_vli].buffer/_ventTotalBuf;
              _layers[_vli].buffer=Math.max(0,_layers[_vli].buffer-_ventDrainG*_ventShare);
            }
          }
          _cumStorageWmin*=(1-_bestVentEff); // vent/lodge resets proportional to efficiency (0.6 pit zip, 0.85 lodge)
        }
      }

      // === PER-LAYER CAP OVERFLOW: excess drips off each layer ===
      for(var _ci=0;_ci<_layers.length;_ci++){
        if(_layers[_ci].buffer>_layers[_ci].cap){_layers[_ci].buffer=_layers[_ci].cap;}
      }

      // === DERIVE cumMoisture from layer sum (backward compat) ===
      var _totalBuffer=0;
      for(var _bi=0;_bi<_layers.length;_bi++){_totalBuffer+=_layers[_bi].buffer;}
      cumMoisture=_totalBuffer/1000; // convert g→L for existing display code
      // PHY-051: Per-cycle precipitation wetting ingress (energy balance path)
      if(precipProbability>0&&activity!=="kayaking"&&activity!=="paddle_boarding"){var _phy060swr=shellWindRes!=null?shellWindRes:(typeof _phy049ShellWR==='number'?_phy049ShellWR:5);var _pcPW=precipWettingRate(precipProbability,tempF,_phy060swr)*(_cycleMin/60);cumMoisture+=_pcPW;_layers[0].buffer+=_pcPW*1000;}


      // PHY-059: Roll cooling events for creek kayaking
      // Per-roll: Q = H_WATER.creek × A_exposed × ΔT × rollDuration
      // Adds heat loss penalty per cycle, scaled by rolls/hour and gear protection
      if(activity==='kayaking'&&kayakType==='creek'&&typeof ROLL_COOLING!=='undefined'){
        var _rcRolls=ROLL_COOLING.rollsPerHour.intermediate; // default to intermediate
        var _rcGear=immersionGear==='drysuit'?ROLL_COOLING.drysuitReduction
          :immersionGear&&immersionGear.indexOf('wetsuit')>=0?ROLL_COOLING.wetsuitReduction
          :ROLL_COOLING.noGearReduction;
        var _rcPerRoll=H_WATER.creek*ROLL_COOLING.exposedAreaM2*((37-(tempF-32)*5/9))*ROLL_COOLING.rollDurationSec/3600;
        var _rcPerCycle=_rcPerRoll*_rcRolls*(_cycleMin/60)*_rcGear;
        // Convert heat loss (watts) to moisture equivalent: cold shock on wet upper body
        // accelerates condensation at the fabric boundary. ~0.5mL per watt-hour of roll cooling.
        var _rcMoistureML=_rcPerCycle*0.5;
        cumMoisture+=_rcMoistureML/1000;
        if(_layers.length>0)_layers[0].buffer+=_rcMoistureML; // shell layer takes the hit
      }

      // PHY-059: Creek splash wetting multiplier
      // Creek rapids produce 1.8× more splash than the base gear wetting rate.
      // Eddy phases are sheltered (0.3×). Net per-cycle: weighted by phase duration.
      if(activity==='kayaking'&&kayakType==='creek'&&typeof IMMERSION_SHIELD!=='undefined'){
        var _csGearWet=(IMMERSION_SHIELD[immersionGear]||{}).wetting||0;
        if(_csGearWet>0){
          // Rapids phase: 10 min at 1.8× splash. Eddy: 3 min at 0.3×.
          var _rapidsMin=10,_eddyMin=3,_totalMin=_rapidsMin+_eddyMin;
          var _creekWetRate=_csGearWet*((_rapidsMin*1.8+_eddyMin*0.3)/_totalMin);
          var _creekWetPerCycle=_creekWetRate*(_cycleMin/60);
          // Add creek-specific wetting ON TOP of base wetting (which is already applied)
          var _extraCreekWet=_creekWetPerCycle-_csGearWet*(_cycleMin/60); // delta only
          if(_extraCreekWet>0){
            cumMoisture+=_extraCreekWet;
            if(_layers.length>0)_layers[0].buffer+=_extraCreekWet*1000;
          }
        }
      }

      // Per-phase display tracking (preserves format for Phase Cycle chart)
      // BUG-133: Use computePerceivedMR (skin-adjacent weighting) at two snapshot points:
      //   Run peak: pre-drain layer buffers (after sweat inflow, before evap drain)
      //   Lift trough: post-drain layer buffers (after evaporative recovery)
      // This produces the sawtooth using the SAME MR formula as perCycleMR/sessionMR.
      var _preDrainLayers=[];
      for(var _pdl=0;_pdl<_layers.length;_pdl++){_preDrainLayers.push({buffer:_preDrainBufs[_pdl],cap:_layers[_pdl].cap});}
      var _runMR=Math.min(10,Math.round(computePerceivedMR(_preDrainLayers)*10)/10);
      var _preDrainMoistureL=0;for(var _pds=0;_pds<_preDrainBufs.length;_pds++){_preDrainMoistureL+=_preDrainBufs[_pds];}
      _preDrainMoistureL/=1000;
      _perPhaseMR.push({phase:'run',cycle:c,mr:_runMR,trapped:Math.round(_preDrainMoistureL*10000)/10000});
      // PHY-049: Compute HLR using dynamic CLO (separate from moisture energy balance)
      var _RcloDynRun=_runCLOdyn*0.155*_cloDeg;
      var _TskDynRun=computeTSkin(coreTemp,_TambC,_Rtissue,_RcloDynRun,_RaRun);
      var _QconvDynRun=computeConvectiveHeatLoss(_TskDynRun,_TambC,_RcloDynRun,_bsa,_windMs,_speedWindMs);
      var _TsDynRun=_TskDynRun-(_TskDynRun-_TambC)*(_RcloDynRun/(_RcloDynRun+_RaRun));
      var _QradDynRun=computeRadiativeHeatLoss(_TsDynRun,_TambC,_bsa);
      var _residDynRun=_Qmet-(_QconvDynRun+_QradDynRun+_respRun.total+7);
      var _runHLwatts=_residDynRun>0?0:Math.abs(_residDynRun);
      var _runHLscore=Math.min(10,_runHLwatts/PHY040_WATTS_PER_POINT);
      // HLR sawtooth: compute core temp + computeHLR for run phase (core+cold+wetness scaling)
      var _coreNow=estimateCoreTemp(LC5_T_CORE_BASE,_cumStorageWmin,_bodyMassKg);
      var _hlrRunScore=computeHLR(_residDynRun,_coreNow,_TambC,sat);
      _perPhaseHL.push({phase:'run',cycle:c,hl:Math.round(_hlrRunScore*1000)/1000,hlWatts:Math.round(_runHLwatts),fatigue:Math.round(_fatigue*1000)/1000});
      // PHY-049: Lift-phase HLR with dynamic CLO at end-of-lift MET (~1.5 after EPOC decay)
      var _liftEndMET=_METlift+_cycleEpoc.aFast*Math.exp(-(_liftMin-0.5)/_cycleEpoc.tauFast)+_cycleEpoc.aSlow*Math.exp(-(_liftMin-0.5)/_cycleEpoc.tauSlow);
      var _liftCLOdyn=computeEffectiveCLO(_baseCLO,_liftEndMET,_phy049ShellWR,windMph,_layers.length);
      var _RcloDynLift=_liftCLOdyn*0.155*_cloDeg;
      var _hcLift=8.3*Math.sqrt(Math.max(0.5,_windMs));
      var _RaLift=1/_hcLift;
      var _TskDynLift=computeTSkin(coreTemp,_TambC,_Rtissue,_RcloDynLift,_RaLift);
      var _QmLift=computeMetabolicHeat(_liftEndMET,_bodyMassKg);
      var _QconvDynLift=computeConvectiveHeatLoss(_TskDynLift,_TambC,_RcloDynLift,_bsa,_windMs,0);
      var _TsDynLift=_TskDynLift-(_TskDynLift-_TambC)*(_RcloDynLift/(_RcloDynLift+_RaLift));
      var _QradDynLift=computeRadiativeHeatLoss(_TsDynLift,_TambC,_bsa);
      var _respLift=computeRespiratoryHeatLoss(_liftEndMET,_TambC,_humFrac,_bodyMassKg,_faceCover);
      var _residDynLift=_QmLift-(_QconvDynLift+_QradDynLift+_respLift.total+7);
      var _liftHLwatts=_residDynLift<0?Math.abs(_residDynLift):0;
      var _liftHLscore=Math.min(10,_liftHLwatts/PHY040_WATTS_PER_POINT);
      // HLR sawtooth: computeHLR for lift phase (uses _coreNow from run-phase block above)
      var _hlrScore=computeHLR(_residDynLift,_coreNow,_TambC,sat);
      // Lift-phase display: post-drain = sawtooth trough (same perceived MR formula, post-drain state)
      var _liftMR=Math.min(10,Math.round(computePerceivedMR(_layers)*10)/10);
      _perPhaseMR.push({phase:'lift',cycle:c,mr:_liftMR,trapped:Math.round(cumMoisture*10000)/10000});
      _perPhaseHL.push({phase:'lift',cycle:c,hl:Math.round(_hlrScore*1000)/1000,hlWatts:Math.round(_liftHLwatts),fatigue:Math.round(_fatigue*1000)/1000});
      // PHY-034: fatigue accumulation
      var _cycleDurF=_runMin+_liftMin;
      if(cumMoisture>=CROSSOVER_LITERS){
        var _fSev=Math.min(1,(cumMoisture-CROSSOVER_LITERS)/(FABRIC_CAPACITY-CROSSOVER_LITERS));
        var _fResist=1-(_fatigue/MAX_FATIGUE);
        _fatigue+=FATIGUE_PER_MIN*_cycleDurF*_fSev*_fResist;
      }else{
        var _fHead=(CROSSOVER_LITERS-cumMoisture)/CROSSOVER_LITERS;
        _fatigue*=(1-RECOVERY_PER_MIN*_cycleDurF*_fHead);
      }
      _fatigue=Math.min(_fatigue,MAX_FATIGUE);
      if(cumMoisture>_systemCap){_cyclesAtCap++;}
      _perCycleFatigue.push(Math.round(_fatigue*1000)/1000);
      _perCycleTrapped.push(cumMoisture);
      // PHY-048: Perceived MR — skin-adjacent weighting (Fukazawa 2003, Zhang 2002)
      var _cMR=Math.min(10,Math.round(computePerceivedMR(_layers)*10)/10);
      var _durPen=_cyclesAtCap>0?applyDurationPenalty(_cMR,_cyclesAtCap*(cycleDur/60)):_cMR;
      _cMR=Math.min(10,Math.round(_durPen*10)/10);
      _perCycleMR.push(_cMR);
      // Diagnostic: per-layer fill after all transfers + drain + vents
      // HLR from end-of-lift deficit + core temp + wetness (LC5 energy balance)
      // PHY-049: HLR scoring — _coreNow and _hlrScore already computed with per-phase pushes above
      _perCycleHL.push(Math.round(_hlrScore*1000)/1000);
      // CDI: compound danger from MR + HLR
      var _cdi=Math.max(_cMR,_hlrScore);
      // Two-tier run classification: green < 3.0 (comfortable), yellow 3.0–5.0 (monitor), bad ≥ 5.0 (Crossover)
      if(_cMR<3.5)_goodRunCount++;
      else if(_cMR<4.0)_yellowRunCount++;
      // LC5 new outputs
      _perCycleCoreTemp.push(Math.round(_coreNow*100)/100);
      _perCycleCIVD.push(Math.round(civdProtectionFactor(_coreNow)*100)/100);
      _perCycleTSkin.push(Math.round(_TskRun*10)/10);
    }

    // Fractional last cycle: proportional per-layer moisture
    if(fracCycle>0){
      var _fracMin=cycleDur*fracCycle;
      var _fracProdG=(_sweatRateRunGhr||0)*(_fracMin/60);
      // Production enters layer[0]
      // Distribute fractional cycle production across layers by condensation weights
      if(_condensWeights&&_condensWeights.length===_layers.length){
        for(var _fi=0;_fi<_layers.length;_fi++){_layers[_fi].buffer+=_fracProdG*_condensWeights[_fi];}
      } else {_layers[0].buffer+=_fracProdG;}
      // Inter-layer transfer (proportional)
      for(var _fli=0;_fli<_layers.length-1;_fli++){
        var _ffill=Math.min(1,_layers[_fli].buffer/_layers[_fli].cap);
        var _fwick=(_layers[_fli].wicking||7)/10;
        var _ftrans=_layers[_fli].buffer*_ffill*_fwick*fracCycle;
        var _fhead=Math.max(0,_layers[_fli+1].cap-_layers[_fli+1].buffer);
        _ftrans=Math.min(_ftrans,_fhead,_layers[_fli].buffer);
        _layers[_fli].buffer-=_ftrans;
        _layers[_fli+1].buffer+=_ftrans;
      }
      // Surface drain (proportional)
      var _fOuter=_layers[_layers.length-1];
      var _fOuterFill=Math.min(1,_fOuter.buffer/_fOuter.cap);
      var _fDrainGPerHr=getDrainRate(tempF,humidity,windMph,_fOuter.im,_totalCLO,_bsa);
      var _fDrainG=Math.min(_fDrainGPerHr*_fracMin/60*_fOuterFill,_fOuter.buffer);
      _fOuter.buffer-=_fDrainG;
      // Cap overflow
      for(var _fci=0;_fci<_layers.length;_fci++){if(_layers[_fci].buffer>_layers[_fci].cap)_layers[_fci].buffer=_layers[_fci].cap;}
      // Derive cumMoisture
      var _fTotalBuf=0;for(var _fbi=0;_fbi<_layers.length;_fbi++){_fTotalBuf+=_layers[_fbi].buffer;}
      cumMoisture=_fTotalBuf/1000;
      if(cumMoisture>_systemCap){cumMoisture=_systemCap;_cyclesAtCap+=fracCycle;}
    }
    // PHY-028b: duration penalty — time spent at saturation cap
    _totalTimeAtCapHrs=_cyclesAtCap*(cycleDur/60);
    netTrapped=Math.max(0,cumMoisture);
  } else if(profile.type==="linear"){
    // Linear phases: sequential, sub-stepped to model realistic saturation dynamics
    // Long phases (e.g. 3hr BC skinning) need periodic drain events — fabric saturates
    // continuously during sustained effort, not just at phase boundaries.
    // Step interval matches typical cyclic period (~15 min) for consistent drain behavior.
    let cumMoisture=initialTrapped||0; // Trip Builder: carry-forward from previous segment
    const stepInterval=15; // minutes — saturation drain applied per step
    const _linDrainGhr=getDrainRate(tempF,humidity,windMph,ensembleIm,activityCLO(activity),_bsa||2.13);
    var _stepsAtCap=0;
    // PHY-034: fatigue for linear activities
    var _linFatigue=0;
    // PHY-041: resolve shell wind resistance for linear profiles
    var _lSwr=shellWindRes!=null?shellWindRes:GENERIC_GEAR_SCORES_BY_SLOT.shell.windResist;
    for(const phase of profile.phases){
      const phaseMin=totalMin*phase.pct;
      const sr=phaseSweatRate(phase.intensity,phaseMin,phase.name);
      const phaseWind=getPhaseWind(phase.windType);
      // PHY-039: ventedMul sealed penalties removed
      const ventedMul=phase.canVent?1.6:1.0;
      var _lVpd=vpdRatio(tempF,humidity);
      // PHY-041: wind penetration through shell — venting halves effective wind resistance
      var _lVentWR=phase.canVent?_lSwr*0.5:_lSwr;
      var _lVEvap=V_BOUNDARY+phaseWind*getWindPenetration(_lVentWR);
      var _lRawEvap=(_lVEvap/20)*_lVpd*ventedMul*imFactor*drysuitEvapBlock*dryAirBonus;
      const evapRate=Math.min(0.85,waderEvapFloor(_lRawEvap,humidity,waderType,fishWading));
      // Sub-step through the phase
      const steps=Math.max(1,Math.round(phaseMin/stepInterval));
      const stepDur=phaseMin/steps;
      // PHY-032: hygroscopic absorption per step (scaled by step duration relative to reference 15min cycle)
      const _stepHygro=hygroAbsorption(tempF,humidity,ensembleIm,DEFAULT_REGAIN)*(stepDur/15);
      for(let s=0;s<steps;s++){
        const produced=sr*(stepDur/60)/1000; // liters per step
        const evaporated=Math.min(produced,evapRate*produced);
        cumMoisture+=Math.max(0,produced-evaporated)+_stepHygro;
        // PHY-051: Per-step precipitation wetting ingress (linear sub-step path)
        if(precipProbability>0&&activity!=="kayaking"&&activity!=="paddle_boarding"){var _phy060swr5=shellWindRes!=null?shellWindRes:5;cumMoisture+=precipWettingRate(precipProbability,tempF,_phy060swr5)*(stepDur/60);}
        // Saturation drain per step — excess drain at 50%+ (VPD with 50% floor)
        if(cumMoisture>_systemCap){
          cumMoisture=_systemCap; // excess drips off
          _stepsAtCap++;
        }
        // PHY-034: fatigue accumulation per step (with marginal resistance)
        if(cumMoisture>=CROSSOVER_LITERS){
          var _lSev=Math.min(1,(cumMoisture-CROSSOVER_LITERS)/(FABRIC_CAPACITY-CROSSOVER_LITERS));
          var _lResist=1-(_linFatigue/MAX_FATIGUE);
          _linFatigue+=FATIGUE_PER_MIN*stepDur*_lSev*_lResist;
        } else {
          var _lHead=(CROSSOVER_LITERS-cumMoisture)/CROSSOVER_LITERS;
          _linFatigue*=(1-RECOVERY_PER_MIN*stepDur*_lHead);
        }
        _linFatigue=Math.min(_linFatigue,MAX_FATIGUE);
      }
    }
    // PHY-028b: track time at cap for linear profiles
    _totalTimeAtCapHrs=_stepsAtCap*(stepInterval/60);
    netTrapped=Math.max(MIN_RETAINED,cumMoisture);
    _fatigue=_linFatigue; // propagate to return object
  }
  // PHY-028c: distribute total trapped moisture across layers (body-outward cascade)
  // Base absorbs first (closest to skin), overflow → mid, then shell, then air gap
  var _layerSat=null;
  if(netTrapped>0){
    var _remaining=netTrapped;
    _layerSat=GENERIC_LAYER_CAPS.map(function(capL){
      var filled=Math.min(_remaining,capL);
      _remaining=Math.max(0,_remaining-capL);
      return Math.round(filled/capL*100); // percentage of this layer's capacity
    });
  }
  // PHY-039: session-level MR score from end-of-session trapped moisture
  // Single source of truth — all 4 pills, gauges, CDI read from this value
  var _mrCap=getEnsembleCapacity(activity);
  // PHY-048: Use perceived MR (per-layer, skin-weighted) when available, else raw ratio
  var _sessionMR=(_perCycleMR&&_perCycleMR.length>0)?_perCycleMR[_perCycleMR.length-1]:Math.min(10,Math.round(7.2*(netTrapped/_mrCap)*10)/10);
  // BUG-136: When vent events are active, use time-weighted average (70% final + 30% mean)
  // This ensures mid-session vent dips reduce the reported MR instead of being invisible
  if(ventEvents&&ventEvents.length>0&&_perCycleMR&&_perCycleMR.length>1){
    var _ventMean=0;for(var _vmi=0;_vmi<_perCycleMR.length;_vmi++){_ventMean+=_perCycleMR[_vmi];}_ventMean/=_perCycleMR.length;
    _sessionMR=Math.round((_sessionMR*0.7+_ventMean*0.3)*10)/10;
  }
  // PHY-028b: duration penalty — prolonged time at saturation cap increases MR
  if(_totalTimeAtCapHrs>0){_sessionMR=Math.min(10,Math.round(applyDurationPenalty(_sessionMR,_totalTimeAtCapHrs)*10)/10);}
  // STEP 2: peak saturation across the trip (NOT end-of-trip layer state)
  // Use the worst per-cycle trapped value, since end-of-trip can be lower than
  // mid-trip peak if layers dried during a break.
  var _step2PeakTrapped=0;
  if(_perCycleTrapped&&_perCycleTrapped.length>0){
    for(var _ptIdx=0;_ptIdx<_perCycleTrapped.length;_ptIdx++){
      if(_perCycleTrapped[_ptIdx]>_step2PeakTrapped)_step2PeakTrapped=_perCycleTrapped[_ptIdx];
    }
  }
  var _step2PeakSatFrac=_mrCap>0?Math.min(1.0,_step2PeakTrapped/_mrCap):0;
  // Always return object with per-cycle data (DATA-FLOW: RunStrip/PhaseCycleMeter need per-cycle arrays)
  // PHY-034: include fatigue (end-of-session insulation degradation) + per-cycle fatigue timeline
  return {trapped:netTrapped,sessionMR:_sessionMR,timeAtCapHrs:_totalTimeAtCapHrs,layerSat:_layerSat,perCycleTrapped:_perCycleTrapped.length>0?_perCycleTrapped:null,perCycleMR:_perCycleMR.length>0?_perCycleMR:null,perCycleWetPenalty:_perCycleHL.length>0?_perCycleHL:null,fatigue:_fatigue||0,perCycleFatigue:_perCycleFatigue&&_perCycleFatigue.length>0?_perCycleFatigue:null,perPhaseMR:_perPhaseMR&&_perPhaseMR.length>0?_perPhaseMR:null,perPhaseHL:_perPhaseHL&&_perPhaseHL.length>0?_perPhaseHL:null,
  // STEP 2: physical state surfacing for active heat balance selection
  perCycleHeatStorage:_perCycleHeatStorage.length>0?_perCycleHeatStorage:null,
  peakHeatBalanceW:_peakCycleHeatBalanceW,
  peakHeatBalanceDirection:_peakCycleHeatBalanceDirection,
  peakHeatBalanceCycleIdx:_peakCycleHeatBalanceIdx,
  totalHeatBalanceWh:Math.round(_cumStorageWmin/60*100)/100,
  peakSaturationFrac:_step2PeakSatFrac,
  // LC5 energy balance outputs
  perCycleCoreTemp:typeof _perCycleCoreTemp!=='undefined'&&_perCycleCoreTemp.length>0?_perCycleCoreTemp:null,
  perCycleCIVD:typeof _perCycleCIVD!=='undefined'&&_perCycleCIVD.length>0?_perCycleCIVD:null,
  totalFluidLoss:typeof _totalFluidLoss!=='undefined'?Math.round(_totalFluidLoss):null,
  fluidLossPerHr:typeof _totalFluidLoss!=='undefined'&&durationHrs>0?Math.round(_totalFluidLoss/durationHrs):null,
  perCycleTSkin:typeof _perCycleTSkin!=='undefined'&&_perCycleTSkin.length>0?_perCycleTSkin:null,
  goodRunCount:typeof _goodRunCount!=='undefined'?_goodRunCount:null,yellowRunCount:typeof _yellowRunCount!=='undefined'?_yellowRunCount:null,
  totalRuns:typeof wholeCycles!=='undefined'?wholeCycles:null,
  // PHY-048: per-layer buffer state
  layerBuffers:typeof _layers!=='undefined'?_layers.map(function(l){return{name:l.name,fiber:l.fiber,buffer:Math.round(l.buffer*10)/10,cap:Math.round(l.cap*10)/10,fill:l.cap>0?Math.round(l.buffer/l.cap*100):0};}):null,
  // Multi-segment: full layer state for chaining to next segment
  endingLayers:typeof _layers!=='undefined'?_layers.map(function(l){return{im:l.im,cap:l.cap,buffer:l.buffer,wicking:l.wicking,fiber:l.fiber,name:l.name};}):null};
}

// ===== risk_functions.js lines 3403-3600 =====
function calcSteadyStateMoisture(activity,tempF,humidity,windMph,durationHrs,sex,weightLb,
  ensembleIm,packLoadMul,fitnessProfile,effInt,totalCLO,gearItems,initialLayers,ventEvents){
  var dt=15; // 15-minute time steps
  var totalMin=durationHrs*60;
  var steps=Math.ceil(totalMin/dt);
  var _bodyMassKg=(weightLb||150)*0.453592;
  var _bsa=0.007184*Math.pow(178,0.725)*Math.pow(_bodyMassKg,0.425);
  var _TambC=(tempF-32)*5/9;
  var _windMs=Math.max(0.5,(windMph||0)*0.44704);
  var _humFrac=(humidity||50)/100;
  var _totalCLO=totalCLO||activityCLO(activity||'camping');
  var _bodyFatPct=20; // default
  var _tissueCLO=computeTissueCLO(_bodyFatPct);
  var _Rtissue=_tissueCLO*0.155;
  var _faceCover='none';

  // MET for stationary activities
  var _metMap={low:1.5,moderate:3,high:5,very_high:7};
  var _actMET=_metMap[effInt||'low']||1.5;
  // Stationary override: treestand/fishing/camp = 1.0–1.5
  if(activity==='hunting'||activity==='fishing'||activity==='camping')_actMET=Math.min(_actMET,1.5);

  // Build or receive layers
  var _layers;
  if(initialLayers&&Array.isArray(initialLayers)&&initialLayers.length>0){
    _layers=initialLayers.map(function(l){return{im:l.im,cap:l.cap,buffer:l.buffer||0,wicking:l.wicking,fiber:l.fiber,name:l.name};});
  } else {
    _layers=buildLayerArray(gearItems,activity,_totalCLO,false);
  }
  var _systemCap=_layers.reduce(function(s,l){return s+l.cap;},0)/1000; // liters for MR calc

  // Vent events (sorted by time in minutes)
  var _vents=ventEvents?ventEvents.slice().sort(function(a,b){return(typeof a==='number'?a:a.time)-(typeof b==='number'?b:b.time);}):[];

  var perTimeMR=[];
  var perTimeHL=[];
  var perTimeCDI=[];
  var perTimeCoreTemp=[];
  var cumStorageWmin=0;
  var _totalFluidLoss=0;

  for(var t=0;t<steps;t++){
    var minuteStart=t*dt;
    var minuteEnd=Math.min(minuteStart+dt,totalMin);
    var stepMin=minuteEnd-minuteStart;

    // Energy balance at current MET
    var coreTemp=estimateCoreTemp(LC5_T_CORE_BASE,cumStorageWmin,_bodyMassKg);
    var _hc=8.3*Math.sqrt(_windMs);
    var _Rclo=_totalCLO*0.155;
    var _Ra=1/_hc;
    var _Tsk=computeTSkin(coreTemp,_TambC,_Rtissue,_Rclo,_Ra);

    var _Qmet=computeMetabolicHeat(_actMET,_bodyMassKg);
    var _Qconv=computeConvectiveHeatLoss(_Tsk,_TambC,_Rclo,_bsa,_windMs,0);
    var _Tsurf=_Tsk-(_Tsk-_TambC)*(_Rclo/(_Rclo+_Ra));
    var _Qrad=computeRadiativeHeatLoss(_Tsurf,_TambC,_bsa);
    var _resp=computeRespiratoryHeatLoss(_actMET,_TambC,_humFrac,_bodyMassKg,_faceCover);
    var _Qpass=_Qconv+_Qrad+_resp.total+7; // 7W insensible
    var _residual=_Qmet-_Qpass;

    // Sweat from energy balance
    var _eReq=Math.max(0,_residual);
    var _outerL=_layers[_layers.length-1];
    var _emax=computeEmax(_Tsk,_TambC,_humFrac*100,_windMs,ensembleIm||0.089,_totalCLO,_bsa);
    var _sr=computeSweatRate(_eReq,_emax.eMax);
    var _sweatG=_sr.sweatGPerHr*(stepMin/60);
    var _insensG=10*(stepMin/60); // 10 g/hr insensible

    // Condensation model (same as cyclic path)
    var _tSkinRetC=30;
    var _tDewMicro=29;
    var _RcloMid=_totalCLO*0.155*0.5;
    var _RairMid=1/_hc;
    var _midFrac=(_totalCLO>0)?_RcloMid/(_totalCLO*0.155+_RairMid):0.5;
    var _tMidC=_TambC+(_tSkinRetC-_TambC)*_midFrac;
    var _condensSeverity=Math.max(0,(_tDewMicro-_tMidC)/_tDewMicro);
    var _netRetention=0.40*_condensSeverity;

    var _vaporExitHr=Math.min(_sr.sweatGPerHr,(_emax.eMax/LC5_L_V)*3600);
    var _surfacePassHr=getDrainRate(tempF,humidity,windMph,_outerL.im,_totalCLO,_bsa);
    var _condensHr=Math.max(0,_vaporExitHr-_surfacePassHr);
    var _excessHr=Math.max(0,_sr.sweatGPerHr-_vaporExitHr);
    var _fabricInG=(_condensHr*_netRetention+_excessHr*_netRetention)*(stepMin/60)+_insensG;

    // Condensation distribution across layers (thermal gradient weights)
    var _Rtotal=_totalCLO*0.155+(1/_hc);
    var _Rcum=0;
    var _condensWeights=[];
    var _wSum=0;
    for(var li=0;li<_layers.length;li++){
      var _layerCLO=_totalCLO/_layers.length;
      _Rcum+=_layerCLO*0.155;
      var _tLayerC=_Tsk-(_Tsk-_TambC)*(_Rcum/_Rtotal);
      var _under=Math.max(0,_tDewMicro-_tLayerC);
      _condensWeights.push(_under);
      _wSum+=_under;
    }
    if(_wSum>0){for(var li=0;li<_condensWeights.length;li++)_condensWeights[li]/=_wSum;}
    else{for(var li=0;li<_condensWeights.length;li++)_condensWeights[li]=1/_layers.length;}

    // Deposit condensation
    for(var li=0;li<_layers.length;li++){
      _layers[li].buffer+=_fabricInG*_condensWeights[li];
    }

    // Overflow cascade INWARD
    for(var li=_layers.length-1;li>0;li--){
      var _ov=Math.max(0,_layers[li].buffer-_layers[li].cap);
      if(_ov>0){_layers[li].buffer=_layers[li].cap;_layers[li-1].buffer+=_ov;}
    }
    _layers[0].buffer=Math.min(_layers[0].buffer,_layers[0].cap);

    // Bidirectional wicking
    for(var li=0;li<_layers.length-1;li++){
      var _fI=_layers[li].cap>0?_layers[li].buffer/_layers[li].cap:0;
      var _fJ=_layers[li+1].cap>0?_layers[li+1].buffer/_layers[li+1].cap:0;
      var _src=_fI>_fJ?li:li+1;
      var _dst=_fI>_fJ?li+1:li;
      if(Math.abs(_fI-_fJ)>0.01){
        var _wr=(_layers[_src].wicking||7)/10;
        var _retFrac=Math.pow(Math.max(0,1-_wr),stepMin);
        var _delta=Math.abs(_fI-_fJ)*_layers[_src].cap*(1-_retFrac)*0.5;
        _delta=Math.min(_delta,_layers[_src].buffer,Math.max(0,_layers[_dst].cap-_layers[_dst].buffer));
        _layers[_src].buffer-=_delta;
        _layers[_dst].buffer+=_delta;
      }
    }

    // Surface drain (outermost layer, PHY-047)
    var _drainHr=getDrainRate(tempF,humidity,windMph,_outerL.im,_totalCLO,_bsa);
    var _outerFill=_outerL.cap>0?Math.min(1,_outerL.buffer/_outerL.cap):0;
    var _drainG=Math.min(_drainHr*(stepMin/60)*_outerFill,_outerL.buffer);
    _outerL.buffer=Math.max(0,_outerL.buffer-_drainG);

    // Vent events
    for(var vi=0;vi<_vents.length;vi++){
      var _vTime=typeof _vents[vi]==='number'?_vents[vi]:_vents[vi].time;
      if(_vTime>=minuteStart&&_vTime<minuteEnd){
        var _ventArea=0.15;
        var _ventBaseIm=(_layers[0]&&_layers[0].im)||0.40;
        var _ventDrainHr=getDrainRate(tempF,humidity,windMph,_ventBaseIm,0.3,_bsa*_ventArea);
        var _ventDrainG=_ventDrainHr*(stepMin/60);
        var _totalBuf=_layers.reduce(function(s,l){return s+l.buffer;},0);
        if(_totalBuf>0&&_ventDrainG>0){
          _ventDrainG=Math.min(_ventDrainG,_totalBuf);
          for(var vli=0;vli<_layers.length;vli++){
            var _share=_layers[vli].buffer/_totalBuf;
            _layers[vli].buffer=Math.max(0,_layers[vli].buffer-_ventDrainG*_share);
          }
        }
      }
    }

    // Heat storage tracking
    var _stepStorage=_residual>0?0:_residual*stepMin; // deficit = cooling
    cumStorageWmin+=_stepStorage;
    _totalFluidLoss+=_sweatG+_insensG+_resp.moistureGhr*(stepMin/60);

    // Perceived MR
    var _percMR=computePerceivedMR(_layers);
    var _cMR=Math.min(10,Math.round(_percMR*10)/10);

    // HLR from deficit + core temp
    var _coreNow=estimateCoreTemp(LC5_T_CORE_BASE,cumStorageWmin,_bodyMassKg);
    var _satFrac=_layers.reduce(function(s,l){return s+l.buffer;},0)/Math.max(1,_layers.reduce(function(s,l){return s+l.cap;},0));
    var _hlr=computeHLR(_residual,_coreNow,_TambC,_satFrac);

    // CDI
    var _cdi=Math.min(10,Math.round(Math.sqrt(_cMR*_hlr)*10)/10);

    perTimeMR.push(_cMR);
    perTimeHL.push(Math.round(_hlr*10)/10);
    perTimeCDI.push(_cdi);
    perTimeCoreTemp.push(Math.round(_coreNow*10)/10);
  }

  var _totalBufML=_layers.reduce(function(s,l){return s+l.buffer;},0);
  var _sessionMR=perTimeMR.length>0?perTimeMR[perTimeMR.length-1]:0;
  var _peakCDI=perTimeCDI.length>0?Math.max.apply(null,perTimeCDI):0;

  return {
    trapped:_totalBufML/1000,
    sessionMR:_sessionMR,
    peakCDI:_peakCDI,
    perTimeMR:perTimeMR,
    perTimeHL:perTimeHL,
    perTimeCDI:perTimeCDI,
    perTimeCoreTemp:perTimeCoreTemp,
    totalFluidLoss:Math.round(_totalFluidLoss),
    endingLayers:_layers.map(function(l){return{im:l.im,cap:l.cap,buffer:l.buffer,wicking:l.wicking,fiber:l.fiber,name:l.name};}),
    layerBuffers:_layers.map(function(l){return{name:l.name,fiber:l.fiber,buffer:Math.round(l.buffer*10)/10,cap:Math.round(l.cap*10)/10,fill:l.cap>0?Math.round(l.buffer/l.cap*100):0};})
  };
}

// applyGearEvent: Modify layer stack between segments based on user gear changes
// Actions: swap (replace layer, reset buffer), add (insert layer), remove (delete layer),
// dry (reduce buffer by time-dependent fraction)

// ===== risk_functions.js lines 3882-3993 =====
function activityCLO(activity){
  return {skiing:2.5,snowboarding:2.5,cross_country_ski:1.8,
    running:0.8,road_cycling:1.2,gravel_biking:1.4,mountain_biking:1.5,
    day_hike:1.5,hiking:1.5,backpacking:1.8,snowshoeing:2.0,
    bouldering:1.2,climbing:1.5,skateboarding:1.0,onewheel:1.0,
    camping:2.0,fishing:1.8,golf:1.2,hunting:1.8,
    kayaking:1.5,paddle_boarding:1.0}[activity]||1.5;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 2C: PHYSICAL ENVELOPE THRESHOLDS
// ═══════════════════════════════════════════════════════════════════
// These constants define the compensation envelope boundaries for
// cold and hot thermal stress. The envelope has a three-band structure
// on the cold side (comfortable / stressed / uncompensated) and a
// two-band structure on the hot side (compensable / uncompensable).
//
// Cold side thresholds are fixed scalars derived from Castellani & Young
// 2016 and ISO 11079:2007. They represent watts of heat deficit beyond
// which the body's compensation mechanisms begin to fail.
//
// Hot side thresholds are NOT scalars — they are computed dynamically
// per-candidate from computeEmax() output, because the body's ability
// to dissipate heat depends on ambient humidity and ensemble vapor
// permeability (Gagge & Gonzalez 1996, Parsons 2014).
//
// Both sides are adjusted for duration (Castellani/ISO 11079 cold-side,
// ISO 7933 hot-side) and biometrics (Parsons 2014, ACSM 2022).
//
// NO scalar weighting factor is applied between cold and hot. The
// asymmetry between cold and hot is captured BY the thresholds
// themselves, not by an invented multiplier.
// ═══════════════════════════════════════════════════════════════════

// Cold envelope reference thresholds (steady-state, unacclimatized, adult baseline)
// Source: Castellani & Young 2016; confirmed in ISO 11079:2007 IREQ framework
var COLD_ENVELOPE_COMFORTABLE_W = 100;  // Vasoconstriction only; below this, no shivering needed.
                                         // Anchor: resting human produces ~100W (basal + postural tone),
                                         // so losing the first 100W is net-zero not net-negative.
var COLD_ENVELOPE_STRESSED_W = 200;      // Shivering compensation active but body stable.
                                         // Upper end of sustainable shivering for well-fed adult.
var COLD_ENVELOPE_UNCOMPENSATED_W = 300; // Beyond max shivering; core temperature drops.
                                         // Anchors to cold-water-immersion immediate exhaustion threshold.

// Hot envelope multipliers on dynamic computeEmax() output
// Source: ISO 7933:2023 PHS model; Gagge & Gonzalez 1996
var HOT_ENVELOPE_COMPENSABLE_MUL = 1.0;      // Up to eMax: body evaporates as fast as it produces
var HOT_ENVELOPE_UNCOMPENSABLE_MUL = 1.5;    // 1.5× eMax: brief tolerance beyond compensable
                                              // (thermal inertia delays core temp rise for ~15-30 min)

// Peak saturation safety gate (from Step 2B, still interim pending calibration audit)
// ═══════════════════════════════════════════════════════════════════
// ⚠ INTERIM CONSTANT — PENDING CALIBRATION AUDIT
// ═══════════════════════════════════════════════════════════════════
// See Interim Constants Ledger. 0.7 is approximately defensible from
// Havenith and Yoo & Kim conductivity-vs-saturation data but the exact
// value is a choice. Audit will confirm or replace.
// ═══════════════════════════════════════════════════════════════════
var INTERIM_PEAK_SAT_GATE_PENDING_AUDIT = 0.7;

// Biometric modifier coefficients (INTERIM — pending calibration audit)
// ═══════════════════════════════════════════════════════════════════
// ⚠ INTERIM CONSTANTS — PENDING CALIBRATION AUDIT
// ═══════════════════════════════════════════════════════════════════
// These coefficients scale the threshold values per-user based on
// body composition, fitness, and sex. The values are derived from
// summary tables in Parsons 2014 and ACSM 2022, but the specific
// coefficients have interpretation latitude.
//
// BF% protects cold (insulation) and harms heat (insulates against
// dissipation). VO2max improves both sides (metabolic reserve + CV
// capacity). Female sex averages higher BSA:mass ratio (slight hot
// advantage, slight cold disadvantage).
//
// REPLACEMENT: Calibration audit extracts coefficients from primary
// literature with explicit citations per value.
// ═══════════════════════════════════════════════════════════════════
var INTERIM_BIOMETRIC_COLD_BF_COEF = 0.30;
var INTERIM_BIOMETRIC_COLD_FITNESS_COEF = 0.10;
var INTERIM_BIOMETRIC_COLD_FEMALE_FACTOR = 0.92;
var INTERIM_BIOMETRIC_HOT_BF_COEF = -0.20;  // negative: BF hurts heat dissipation
var INTERIM_BIOMETRIC_HOT_FITNESS_COEF = 0.15;
var INTERIM_BIOMETRIC_HOT_FEMALE_FACTOR = 1.05;

// Duration adjustment curve coefficients (INTERIM — approximations of ISO curves)
// ═══════════════════════════════════════════════════════════════════
// ⚠ INTERIM CONSTANTS — CLOSED-FORM APPROXIMATIONS OF ISO CURVES
// ═══════════════════════════════════════════════════════════════════
// These constants parameterize closed-form approximations of the
// duration-limited exposure curves from ISO 11079 (cold) and ISO 7933
// (hot). The full ISO implementations are time-stepped simulations
// that require 4-6 hours of dedicated implementation work. The
// approximations below capture the general shape of the curves with
// errors estimated at under 15% for durations between 0.25 and 8 hours.
//
// Approximation form: threshold_duration_multiplier = 1.0 + A / (hours^B)
// - At reference duration (2 hours), multiplier ≈ 1.0
// - At short durations (< 1 hr), multiplier > 1.0 (brief tolerance higher)
// - At long durations (> 4 hr), multiplier < 1.0 (sustained tolerance lower)
//
// REPLACEMENT: Full ISO 11079 and ISO 7933 implementations as
// time-stepped simulators, with regression tests confirming the
// approximation curves and the full implementations agree within
// tolerance before the approximation is retired.
// ═══════════════════════════════════════════════════════════════════
var INTERIM_DURATION_CURVE_COLD_A = 0.8;   // approximation coefficient A for cold duration
var INTERIM_DURATION_CURVE_COLD_B = 0.7;   // approximation coefficient B for cold duration
var INTERIM_DURATION_CURVE_HOT_A = 0.6;    // approximation coefficient A for hot duration
var INTERIM_DURATION_CURVE_HOT_B = 0.5;    // approximation coefficient B for hot duration

// Helper: duration adjustment factor for cold threshold
// Returns a multiplier that scales the steady-state threshold for the
