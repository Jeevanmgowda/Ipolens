/**
 * Registrar response fixtures. These are hand-built from the response shapes the registrar web
 * pages are known to return (ASP.NET `{ d: ... }` wrappers, DataSet XML, JSON tables). Refresh
 * them from a real check when a registrar changes format; see README "Registrar format changed".
 */

export const linkintimeAllotted = {
  d: '<NewDataSet><Table><companyname>FOODLINK F&amp;B HOLDINGS (INDIA) LIMITED</companyname><NAME1>TEST HOLDER</NAME1><SHARES>78</SHARES><ALLOT>78</ALLOT><APPLICATION_NO>1234567890</APPLICATION_NO><DPCLID>IN30000012345678</DPCLID></Table></NewDataSet>',
};

export const linkintimeNotAllotted = {
  d: '<NewDataSet><Table><companyname>FOODLINK</companyname><SHARES>78</SHARES><ALLOT>0</ALLOT></Table></NewDataSet>',
};

export const linkintimeEmpty = { d: '<NewDataSet></NewDataSet>' };

/** Already-parsed JSON (some deployments return objects instead of XML strings). */
export const linkintimeJsonWrapped = { d: JSON.stringify([{ companyname: 'X', shares: '156', allot: '78' }]) };

export const kfintechAllotted = { data: [{ applicationNo: 'KF123', appliedShares: 156, allottedShares: 78, dpId: '12081600' }] };
export const kfintechNotAllotted = { data: [{ applicationNo: 'KF124', appliedShares: 78, allottedShares: 0 }] };

export const bigshareAllotted = { d: { APPLIED: '78', ALLOTED: '78', APPLICATION_NO: 'BS1' } };
export const bigshareNotFound = { d: { Message: 'No Record Found / Not Allotted' } };

export const captchaHtml = '<!DOCTYPE html><html><head><title>Verify</title></head><body><div class="g-recaptcha"></div></body></html>';
