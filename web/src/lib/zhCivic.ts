import type { Board } from "../../../server/lib/boards.ts";
import type { Lang } from "./i18n";

const BOROUGH: Record<string, string> = {
  Queens: "皇后区",
  Brooklyn: "布鲁克林",
  Manhattan: "曼哈顿",
  Bronx: "布朗克斯",
  "Staten Island": "史泰登岛",
};

const HOOD: Record<string, string> = {
  "Long Island City": "长岛市",
  Sunnyside: "阳光园",
  Woodside: "伍德赛德",
  Maspeth: "马斯佩斯",
  Astoria: "阿斯托里亚",
  "Old Astoria": "旧阿斯托里亚",
  Ridgewood: "里奇伍德",
  "Middle Village": "中村",
  Glendale: "格伦代尔",
  Greenpoint: "绿点",
  Williamsburg: "威廉斯堡",
  "East Williamsburg": "东威廉斯堡",
  Chelsea: "切尔西",
  "Hell's Kitchen": "地狱厨房",
};

const ACTION: Record<string, string> = {
  "Zoning map amendment": "区划地图修订",
  "Zoning text amendment": "区划文本修订",
  "Special permit": "特别许可",
  Authorization: "授权",
  Certification: "认证",
  "Substantial compliance": "实质合规",
  "Site selection and acquisition": "选址与收购",
  Acquisition: "收购",
  "City map change": "城市地图变更",
  "Urban development action": "城市发展行动",
  Landmark: "地标",
  "Landmark designation": "地标指定",
};

const APPLICANT_TYPE: Record<string, string> = {
  Private: "私人",
  "Other Public Agency": "其他公共机构",
  "City Agency": "市政府机构",
};

const AGENCY: Record<string, string> = {
  "DPR - Department of Parks & Recreation NYC": "纽约市公园与休憩局（DPR）",
  "NYC DOT Department of Transportation": "纽约市交通局（DOT）",
  "LPC - NYC Landmarks Preservation Commission": "纽约市地标保护委员会（LPC）",
};

/** Milestone pieces published by NYC Planning, split on " - ". */
const MILESTONE: Record<string, string> = {
  PC: "选址与收购",
  EAS: "环境评估",
  ZM: "区划地图",
  ZC: "认证",
  MM: "城市地图",
  HI: "地标",
  ZR: "区划文本",
  "Ad-hoc": "专项",
  "CPC Public Meeting": "市规划委员会公开会议",
  Vote: "表决",
  "Community Board Referral": "转介社区委员会",
  "Review Session": "审议会议",
  "Post Hearing Follow-Up / Future Votes": "听证后跟进／后续表决",
  "Certified / Referred": "已认证或已转介",
  "Review Filed Land Use Application": "审查已提交的土地使用申请",
  "Prepare Filed Land Use Application": "准备已提交的土地使用申请",
  "City Council Review": "市议会审查",
  "Project Readiness": "项目准备情况",
  "CPC Review of Modification Scope": "市规划委员会审查修改范围",
  "Borough President Referral": "转介区长",
  "Project Completed": "项目已完成",
  "Review Draft Land Use Application": "审查土地使用申请草稿",
};

/** Exact city text. Shown only when the English still matches, so a changed record is not given a stale translation. */
const COPY: Record<string, string> = {
  "Queens CD 2 Walk to Park Site Selection/Acq.": "皇后区第2社区区“步行到公园”选址与收购",
  "The Department of Parks and Recreation (DPR), along with co-applicant the Department of Citywide Administrative Services (DCAS), seeks approval for the acquisition and site selection (PC) of privately-owned properties for future park development to close the walk to park gap in Community District 2, Queens.":
    "纽约市公园与休憩局（DPR）与共同申请人全市行政服务局（DCAS）寻求批准，收购并选定私人地块（PC），用于未来公园建设，以消除皇后区第2社区区“步行到公园”的缺口。",
  "44-17 Greenpoint Avenue Rezoning": "绿点大道44-17号区划变更",
  "A zoning map amendment from R6A/C1-4 to R7X/C2-4 and R7A/C2-4 zoning districts and a zoning text amendment to map MIH to facilitate the development of a new 11-story mixed-use building, 142,593 sq ft approximately 143 DUs, (36-42 DU's MIH), including community facility and commercial space on the ground floor, is being sought by ZDJ Greenpoint LLC at 44-17 Greenpoint Ave in Sunnyside, Community District 2, Queens.":
    "ZDJ Greenpoint LLC正在阳光园、皇后区第2社区区绿点大道44-17号申请区划地图修订（由R6A/C1-4改为R7X/C2-4和R7A/C2-4）以及区划文本修订以划定强制包容性住房（MIH）区域，以便建设一栋新的11层混合用途建筑，约142,593平方英尺、约143套住宅（其中36至42套为MIH），底层设有社区设施和商业空间。",
  "21-31 46th Ave Rezoning": "第46大道21-31号区划变更",
  "A zoning map amendment from M1-4/R6B district to R7X/C2-5 and a zoning text amendment to map an MIH area to facilitate the development of a new 11-story, approximately 80,850 sf mixed-use commercial and residential building, including 8,000 sf of retail use, 72,850 sf of residential uses, and 70 dwelling units, is being sought by 21-31 Holdings LLC at 21-31 46th Avenue in the Long Island City, Community District 2, Queens.":
    "21-31 Holdings LLC正在长岛市、皇后区第2社区区第46大道21-31号申请区划地图修订（由M1-4/R6B改为R7X/C2-5）以及区划文本修订以划定MIH区域，以便建设一栋新的11层、约80,850平方英尺的混合商业与住宅建筑，其中包括8,000平方英尺零售、72,850平方英尺住宅和70套住宅。",
  "50-02 Queens Blvd Rezoning": "皇后大道50-02号区划变更",
  "A zoning map amendment from M1-1 to R7X/C2-4 and R6A and a zoning text amendment to Appendix F to map MIH to facilitate a new 9-story, ~261,100-square-foot building, 240,120 square feet of residential use (257 units; 64 income restricted), ~16,700 square feet of commercial use, and ~4,760 square feet of community facility use is being sought by 5002 Woodside Development LLC at 50-02 Queens Boulevard in Woodside, Community District 2, Queens.":
    "5002 Woodside Development LLC正在伍德赛德、皇后区第2社区区皇后大道50-02号申请区划地图修订（由M1-1改为R7X/C2-4和R6A）以及区划文本修订（附录F）以划定MIH，以便建设一栋新的9层、约261,100平方英尺建筑，其中住宅约240,120平方英尺（257套，64套收入限制）、商业约16,700平方英尺、社区设施约4,760平方英尺。",
  "50-01 Queens Boulevard Rezoning": "皇后大道50-01号区划变更",
  "A zoning map amendment from R7X/C2-3 and R6/C2-3 to R8A/C2-4 and a zoning text amendment to Appendix F to map MIH to facilitate the development of a new 16-story mixed-use building, 117,750 zoning sq ft (154 DUs), including community facility and commercial space on the ground floor, is being sought by ZDJ QUEENS 50 LLC at 50-01 Queens Boulevard in Woodside, Community District 2, Queens.":
    "ZDJ QUEENS 50 LLC正在伍德赛德、皇后区第2社区区皇后大道50-01号申请区划地图修订（由R7X/C2-3和R6/C2-3改为R8A/C2-4）以及区划文本修订（附录F）以划定MIH，以便建设一栋新的16层混合用途建筑，区划面积117,750平方英尺（154套住宅），底层设有社区设施和商业空间。",
  "31-10 & 31-16 Hunters Point Ave Rezoning": "猎人角大道31-10号与31-16号区划变更",
  "A zoning map amendment from M2-1 to M1-5 to facilitate a new 7 story, mixed use commercial and manufacturing building with approximately 83,500 zsf, including 39,650 zsf of commercial space and 43,850 zsf of manufacturing space, is being sought by 31-10 Hunters Point LLC at 31-10 and 31-16 Hunters Point Avenue in Long Island City, Community District 2, Queens.":
    "31-10 Hunters Point LLC正在长岛市、皇后区第2社区区猎人角大道31-10号和31-16号申请区划地图修订（由M2-1改为M1-5），以便建设一栋新的7层混合商业与制造业建筑，约83,500区划平方英尺，其中包括39,650平方英尺商业空间和43,850平方英尺制造业空间。",
  "Astoria Cove WF Cert and Substantial Compliance": "阿斯托里亚湾滨水认证与实质合规",
  "A new waterfront certification and a substantial compliance application to the previously approved Astoria Cove rezoning is being sought by KS Astoria LLC in Astoria, Community District 1, Queens.":
    "KS Astoria LLC正在阿斯托里亚、皇后区第1社区区申请一项新的滨水认证，以及对先前已批准的阿斯托里亚湾区划变更的实质合规申请。",
  "43-02 Ditmars Boulevard Rezoning": "迪特马斯大道43-02号区划变更",
  "A zoning map amendment from M1-1 to R7A/C2-4, R6A/C2-4 and R6B and a zoning text amendment to Appendix F to map MIH to facilitate a redevelopment of an existing one-to-two story shopping center, resulting in a mixed-use building including 492 dwelling units (123 income-restricted) and 62,000 sf of ground floor retail, is being sought by LaGuardia Center Realty LLC at 43-02 Ditmars Boulevard in Astoria, Community District 1, Queens.":
    "LaGuardia Center Realty LLC正在阿斯托里亚、皇后区第1社区区迪特马斯大道43-02号申请区划地图修订（由M1-1改为R7A/C2-4、R6A/C2-4和R6B）以及区划文本修订（附录F）以划定MIH，以便重新开发现有的一至两层购物中心，建成混合用途建筑，包括492套住宅（123套收入限制）和62,000平方英尺底层零售。",
  "20th Ave Elimination, Discontinuance and Closing": "第20大道废除、停用与封闭",
  "An application by a private applicant, Maric 1903 LLC involving the elimination, discontinuance and closing of 20th Avenue between 75th Street and 76th Street, in Community District 1, Borough of Queens, to facilitate future residential development.":
    "私人申请人Maric 1903 LLC申请废除、停用并封闭皇后区第1社区区内第75街与第76街之间的第20大道，以便进行未来的住宅开发。",
  "63-02 Fresh Pond Road Rezoning": "清池路63-02号区划变更",
  "A zoning map amendment from R5B/C1-4 to R6A/C2-4 and a zoning text amendment to Appendix F to establish an MIH Area to facilitate a new 7-story mixed-use, 51,300 sf development, including 7,000 sf of commercial floor area and 54 dwelling units, of which 14 are income-restricted, is being sought by 63-02 Fresh Pond Realty LLC at 63-02 Fresh Pond Road in Ridgewood, Community District 5, Queens.":
    "63-02 Fresh Pond Realty LLC正在里奇伍德、皇后区第5社区区清池路63-02号申请区划地图修订（由R5B/C1-4改为R6A/C2-4）以及区划文本修订（附录F）以设立MIH区域，以便建设一栋新的7层混合用途、51,300平方英尺的开发项目，其中包括7,000平方英尺商业面积和54套住宅，其中14套为收入限制。",
  "57th Drive Demapping": "第57车道从地图中删除",
  "A City Map change to demap a portion of 57th Drive in Maspeth, Community District 5, Queens, is being sought by the New York City Department of Transportation and New York City Department of Design and Construction to facilitate the use of space for DOT parking of fleet vehicles.":
    "纽约市交通局与纽约市设计与建设局正在马斯佩斯、皇后区第5社区区申请城市地图变更，从地图中删除第57车道的一部分，以便将该空间用于交通局车队停放。",
  "10-86 Cypress Avenue Rezoning": "柏树大道10-86号区划变更",
  "A zoning map amendment from M1-4D to R7A/C2-4 and a zoning text amendment to Appendix F to map MIH to facilitate two new mixed-use buildings with 55 dwelling units (14 income-restricted) and 11,316 square feet of ground floor commercial use is being sought by CYPRESS B.Z.V. CORP. at 10-86 Cypress Avenue in Ridgewood, Community District 5, Queens.":
    "CYPRESS B.Z.V. CORP.正在里奇伍德、皇后区第5社区区柏树大道10-86号申请区划地图修订（由M1-4D改为R7A/C2-4）以及区划文本修订（附录F）以划定MIH，以便建设两栋新的混合用途建筑，共55套住宅（14套收入限制）和11,316平方英尺底层商业用途。",
  "Monitor Point": "莫尼特角",
  "A LSGD, ZM, ZR, a Chair Cert, and a City Map Amendment (see 2025K0287), to facilitate the development of a new 33,000 gsf Museum and educational facility, and two additional new buildings with approximately 877,88 gsf of residential space with approximately 1,150 dwelling units (300 income restricted) approx. 25,700 sf of local retail space, and approx. 37,000 gsf of below grade parking, and approx. 45,000 sf of new open space at 40 Quay Street, CD1, Brooklyn.":
    "一项大型综合开发（LSGD）、区划地图修订、区划文本修订、主席认证以及城市地图修订（见2025K0287），以便在布鲁克林第1社区区码头街40号建设一座新的33,000总平方英尺博物馆与教育设施，以及另外两栋新建筑，约877,88总平方英尺住宅空间、约1,150套住宅（300套收入限制）、约25,700平方英尺本地零售、约37,000总平方英尺地下停车和约45,000平方英尺新开放空间。",
  "Monitor Point - 56 Quay Demapping": "莫尼特角—码头街56号从地图中删除",
  "A City Map Amendment by GO Quay LLC and Greenpoint Monitor Museum to remove a Park designation on BK Block 2590, Lot 25, which is privately owned by the Greenpoint Monitor Museum (not parkland owned by the City), in order to facilitate the development of a new 33,000 sf museum and educational facility, and publicly-accessible waterfront open space. The project is located in Greenpoint, CD 1, Brooklyn. This project is related to Project ID 2024K0358, which details the other land use actions.":
    "GO Quay LLC与绿点莫尼特博物馆申请城市地图修订，取消布鲁克林地块2590、地块25上的公园标注。该地块由绿点莫尼特博物馆私人拥有（并非市政府所有的公园用地），以便建设一座新的33,000平方英尺博物馆与教育设施，以及公众可进入的滨水开放空间。项目位于布鲁克林绿点第1社区区。本项目与项目编号2024K0358相关，该项目说明了其他土地使用事项。",
  "200 Kent Avenue Rezoning": "肯特大道200号区划变更",
  "A zoning map amendment from M1-4 to M1-4A/R7X and zoning text amendment to map MIH (Appendix F) to facilitate the conversion and expansion of an existing non-residential 5-story building to a mixed-use 14-story, approximately 135,840 sf (143 DUs, 36 MIH) development, including 93,529 sf of residential floor area and 41,982 sf of commercial floor area, is being sought by 200 Kent I LLC and 206 Kent Investor LLC at 200 Kent Avenue in Williamsburg, Community District 1, Brooklyn.":
    "200 Kent I LLC与206 Kent Investor LLC正在威廉斯堡、布鲁克林第1社区区肯特大道200号申请区划地图修订（由M1-4改为M1-4A/R7X）以及区划文本修订以划定MIH（附录F），以便将现有非住宅5层建筑改建并扩建为14层、约135,840平方英尺的混合用途开发（143套住宅，36套MIH），其中包括93,529平方英尺住宅面积和41,982平方英尺商业面积。",
  "289 Kent Avenue Rezoning": "肯特大道289号区划变更",
  "A zoning map amendment from M3-1 to M1-3A/R7X (MX-8) and M1-2A zoning districts and a zoning text amendment to Appendix F to map MIH to facilitate the development of an 18 story mixed-use residential and commercial building including 243,500 sf residential space with 278 dwelling units, of which approximately 70 units will be income-restricted and 29,300 sf commercial space is being sought by Web Holdings LLC at 289 Kent Avenue in Williamsburg, Community District 1, Brooklyn.":
    "Web Holdings LLC正在威廉斯堡、布鲁克林第1社区区肯特大道289号申请区划地图修订（由M3-1改为M1-3A/R7X（MX-8）和M1-2A）以及区划文本修订（附录F）以划定MIH，以便建设一栋18层混合住宅与商业建筑，包括243,500平方英尺住宅空间、278套住宅（其中约70套为收入限制）和29,300平方英尺商业空间。",
  "2 Noble Street Waterfront Cert": "诺布尔街2号滨水认证",
  "A waterfront certification pursuant to ZR section ZR 62-811(c) to facilitate two new residential and commercial mixed-use developments, including 890,000 square feet of residential floor area (1,060 units, 267 income-restricted) and 31,380 square feet of waterfront public access area, is being sought by TF Cornerstone at 2 Noble Street in Greenpoint, Community District 1, Brooklyn.":
    "TF Cornerstone正在绿点、布鲁克林第1社区区诺布尔街2号申请依据区划决议第62-811(c)条的滨水认证，以便建设两个新的住宅与商业混合用途开发项目，包括890,000平方英尺住宅面积（1,060套，267套收入限制）和31,380平方英尺滨水公共通道区域。",
  "410 Morgan Avenue Rezoning": "摩根大道410号区划变更",
  "A Zoning Map Amendment from M1-1 to M2-4A and M2-3A to facilitate the expansion of an existing one-story manufacturing building (adding approximately 100,000 square feet for a total of approximately 125,000 sf and six stories), is being sought by private applicant Signs + Decal Corporation at 410 Morgan Avenue in East Williamsburg, Community District 1, Brooklyn.":
    "私人申请人Signs + Decal Corporation正在东威廉斯堡、布鲁克林第1社区区摩根大道410号申请区划地图修订（由M1-1改为M2-4A和M2-3A），以便扩建现有一层制造业建筑（增加约100,000平方英尺，总计约125,000平方英尺、六层）。",
  "470 Kent Ave. RD modification": "肯特大道470号限制性声明修改",
  "A non-ULURP modification of restrictive declaration by the declarant 470 Kent Ave. Associates to add a revised drawing exhibit":
    "声明人470 Kent Ave. Associates申请对限制性声明作非ULURP修改，以增加一份修订后的图纸附件。",
  "Dewitt Clinton Park North (629 West 54th Street)": "德威特·克林顿公园北侧（西54街629号）",
  "A private application by 760 12th LLC for a zoning map amendment from M2-4 to C4-7, a zoning text amendment to map a Special Hudson River Park District and MIH area, and a special permit pursuant to ZR 89-21 to facilitate a new 44-story, approximately 506,088 square-foot, mixed-use residential and commercial development located at 629 West 54th Street in the Special Clinton District, Community District 4, Manhattan.":
    "私人申请人760 12th LLC申请区划地图修订（由M2-4改为C4-7）、区划文本修订以划定特殊哈德逊河公园区及MIH区域，以及依据区划决议第89-21条的特别许可，以便在曼哈顿第4社区区特殊克林顿区内西54街629号建设一栋新的44层、约506,088平方英尺的混合住宅与商业开发项目。",
  "Dewitt Clinton Park North (801 Eleventh Avenue)": "德威特·克林顿公园北侧（第十一大道801号）",
  "A private application sought by 801 11th Avenue LLC for a zoning map amendment from M2-3 to C4-7, a zoning text amendment to map Special Hudson River Park District and MIH area, and a special permit pursuant to ZR section 89-21 to facilitate a new 38-story, approximately 386,352-square-foot mixed residential and commercial development at 801 11th Avenue in the Special Clinton District, Community District 4, Manhattan.":
    "私人申请人801 11th Avenue LLC申请区划地图修订（由M2-3改为C4-7）、区划文本修订以划定特殊哈德逊河公园区及MIH区域，以及依据区划决议第89-21条的特别许可，以便在曼哈顿第4社区区特殊克林顿区内第十一大道801号建设一栋新的38层、约386,352平方英尺的混合住宅与商业开发项目。",
  "Lithuanian Alliance Building (LP-2695)": "立陶宛联盟大楼（LP-2695）",
  "An application by the Landmarks Preservation Commission for an individual landmark designation of the Lithuanian Alliance Building, located at 307 West 30th Street, in the Chelsea neighborhood of Manhattan, Community District 4.":
    "地标保护委员会申请将位于曼哈顿切尔西、第4社区区西30街307号的立陶宛联盟大楼指定为单体地标。",
  "515 West 57th Street Rezoning": "西57街515号区划变更",
  "A private application for a zoning map amendment from M1-5(CL) to a C6-12(CL) and a zoning text amendment to establish the project area as an MIH area, to facilitate a new 30-story, approximately 377,970-square-foot mixed residential and commercial development with approximately 394 dwelling units total (119 affordable) at 515 West 57th Street in the Special Clinton District, Community District 4, Manhattan.":
    "私人申请将区划地图由M1-5(CL)改为C6-12(CL)，并修订区划文本将该项目区域设为MIH区域，以便在曼哈顿第4社区区特殊克林顿区内西57街515号建设一栋新的30层、约377,970平方英尺的混合住宅与商业开发项目，共计约394套住宅（119套可负担）。",
  "304 West 49th Street": "西49街304号",
  "A zoning text amendment to facilitate a new 20-story residential building with approximately 60,330 square feet of floor area and 72 dwelling units, is being sought by 304 West 49th Street Garage LLC at 304 West 49th Street in the Hell's Kitchen Neighborhood of Manhattan, Community District 4.":
    "304 West 49th Street Garage LLC正在曼哈顿地狱厨房、第4社区区西49街304号申请区划文本修订，以便建设一栋新的20层住宅建筑，约60,330平方英尺、72套住宅。",
  "413-421 Ninth Avenue (HY DIB and Office Cert.)": "第九大道413–421号（哈德逊广场地区改善奖励与办公认证）",
  "Chair certifications pursuant to 93-31 (Hudson Yards District Improvement Bonus) and 93-131 (Hudson Yards office certification) to facilitate a 239,999-square-foot, 35-story commercial office building with ground-floor retail is being sought by Romeo-Kilo Corp. and CBP Hudson Ninth Avenue Owner LLC in Manhattan CB4":
    "Romeo-Kilo Corp.与CBP Hudson Ninth Avenue Owner LLC正在曼哈顿第4社区区申请依据第93-31条（哈德逊广场地区改善奖励）和第93-131条（哈德逊广场办公认证）的主席认证，以便建设一栋239,999平方英尺、35层、底层设有零售的商业办公楼。",
};

export function zhBorough(name: string, lang: Lang): string {
  return lang === "zh" ? (BOROUGH[name] ?? name) : name;
}

export function zhBoardName(board: Board, lang: Lang): string {
  return lang === "zh" ? `${zhBorough(board.borough, lang)}第${board.number}社区委员会` : board.name;
}

export function zhBoardShort(board: Board, lang: Lang): string {
  return lang === "zh" ? zhBoardName(board, lang) : board.shortName;
}

export function zhNeighborhoods(names: string[], lang: Lang): string[] {
  return lang === "zh" ? names.map((name) => HOOD[name] ?? name) : names;
}

function zhDistricts(text: string): string | null {
  if (!/^[A-Za-z' ]+ CB \d+(, [A-Za-z' ]+ CB \d+)*$/.test(text)) return null;
  return text.replace(/([A-Za-z' ]+) CB (\d+)/g, (_, borough: string, num: string) => `${BOROUGH[borough.trim()] ?? borough.trim()}第${num}社区委员会`);
}

function zhMilestone(text: string): string | null {
  const trimmed = text.replace(/^\s*-\s*/, "");
  const parts = trimmed.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (!parts.length || (parts.length < 2 && !text.includes("-"))) return null;
  const mapped = parts.map((part) => MILESTONE[part]);
  return mapped.every(Boolean) ? mapped.join("—") : null;
}

function zhPlace(text: string): string {
  return text
    .replace(/ · (\d+) tax lots$/, " · $1个税块")
    .replace(/\bQueens Blvd\b/g, "皇后大道")
    .replace(/\bGreenpoint Ave\b/g, "绿点大道")
    .replace(/\bHunters Point Ave\b/g, "猎人角大道")
    .replace(/\bFresh Pond Rd\b/g, "清池路")
    .replace(/\bCypress Ave\b/g, "柏树大道")
    .replace(/\bKent Ave\b/g, "肯特大道")
    .replace(/\bQuay St\b/g, "码头街")
    .replace(/\bWest (\d+) St\b/g, "西$1街")
    .replace(/\b(\d+) Ave\b/g, "第$1大道")
    .replace(/\b(\d+) St\b/g, "第$1街")
    .replace(/\bAve\b/g, "大道")
    .replace(/\bSt\b/g, "街")
    .replace(/\bBlvd\b/g, "大道")
    .replace(/\bRd\b/g, "路")
    .replace(/\bDr\b/g, "车道")
    .replace(/\bPl\b/g, "坊");
}

function looksLikePlace(text: string): boolean {
  if (/\b(LLC|Corp|Corporation|Associates|Inc|Museum)\b/i.test(text)) return false;
  return text.length < 80 && !text.includes(".") && (/tax lots$/.test(text) || /\b(Ave|St|Blvd|Rd|Dr|Pl)\b/.test(text));
}

/** City record text in the active language. Untranslated strings stay in English. */
export function zhCivic(text: string, lang: Lang): string {
  if (lang !== "zh") return text;
  return COPY[text] ?? ACTION[text] ?? APPLICANT_TYPE[text] ?? AGENCY[text] ?? zhDistricts(text) ?? zhMilestone(text) ?? (looksLikePlace(text) ? zhPlace(text) : text);
}

export function zhTranslated(text: string | null, lang: Lang): boolean {
  return !!text && lang === "zh" && zhCivic(text, lang) !== text;
}
