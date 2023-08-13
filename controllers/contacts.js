const Contact = require("../models/Contact");
const { Op } = require("sequelize");
const { sq } = require("../dbConfig");

const findContactAndParent = async (attribute, value) => {
  try {
    let contact, parentContact; //get the contact immediately linked with phone/email might not be primary
    contact = await Contact.findOne({
      where: { [attribute]: value },
      order: [["createdAt", "ASC"]],
    });
    parentContact = // get the primary contact for the previously found contact
      contact === null || contact?.linkedPrecedence === "primary"
        ? contact
        : await Contact.findOne({ where: { id: contact.linkedId } });
    return [true, parentContact];
  } catch (error) {
    console.log("error: ", error);
    return [false, error.message];
  }
};

exports.createContact = async (req, res) => {
  try {
    let { email: email_, phoneNumber: phoneNumber_ } = req.body;

    if (email_ === null && phoneNumber_ === null)
      return res.json({ message: "Need atleast one field" });

    if (phoneNumber_ !== null) phoneNumber_ = phoneNumber_.toString();
    const existingContact = await Contact.findOne({
      where: { [Op.and]: [{ phoneNumber: phoneNumber_ }, { email: email_ }] },
    });
    let parentId; // id of the primaryContact
    if (!existingContact) {
      let [phoneContactSucces, phoneContact] = await findContactAndParent(
        "phoneNumber",
        phoneNumber_
      );
      if (!phoneContactSucces)
        return res.status(500).json({
          error: phoneContact,
        });

      let [emailContactSuccess, emailContact] = await findContactAndParent(
        "email",
        email_
      );

      if (!emailContactSuccess)
        return res.status(500).json({
          error: emailContact,
        });

      if (!phoneContact && !emailContact) {
        // No contact exists - Create New Contact
        const newContact = await Contact.create(req.body);
        parentId = newContact.id;
      } else if (emailContact?.id !== phoneContact?.id) {
        // primary contacts are different for given phoneNumber and email
        if (
          emailContact === null ||
          emailContact?.createdAt > phoneContact?.createdAt
        ) {
          // if primary contact linked to given phoneNumber is older than primary contact linked to email
          parentId = phoneContact.id;
          await Contact.create({
            email: email_,
            phoneNumber: phoneNumber_,
            linkedPrecedence: "secondary",
            linkedId: phoneContact.id,
          });
          if (emailContact !== null) {
            await Contact.update(
              {
                linkedPrecedence: "secondary",
                linkedId: phoneContact.id,
              },
              {
                where: {
                  [Op.or]: [
                    { id: emailContact.id },
                    { linkedId: emailContact.id },
                  ],
                },
              }
            );
          }
        } else {
          // if primary contact linked to given email is older than primary contact linked to phoneNumber
          parentId = emailContact.id;
          await Contact.create({
            email: email_,
            phoneNumber: phoneNumber_,
            linkedPrecedence: "secondary",
            linkedId: emailContact.id,
          });
          if (phoneContact !== null) {
            await Contact.update(
              {
                linkedPrecedence: "secondary",
                linkedId: emailContact.id,
              },
              {
                where: {
                  [Op.or]: [
                    { id: phoneContact.id },
                    { linkedId: phoneContact.id },
                  ],
                },
              }
            );
          }
        }
      } else {
        // both parents/pimary are same
        parentId = emailContact.id;
        await Contact.create({
          email: email_,
          phoneNumber: phoneNumber_,
          linkedPrecedence: "secondary",
          linkedId: emailContact.id,
        });
      }
    } else {
      // if contact exists for a given email and phoneNumber just fetch the id of the primaryContact.
      if (existingContact.linkedId !== null)
        parentId = existingContact.linkedId;
      else parentId = existingContact.id;
    }

    const allContacts = await Contact.findAll({
      // find all contacts connected to parent/primary contact.
      where: { [Op.or]: [{ id: parentId }, { linkedId: parentId }] },
    });
    let emails = new Set(),
      phoneNumbers = new Set(),
      sids = [];

    allContacts.forEach((item) => {
      emails.add(item.email);
      phoneNumbers.add(item.phoneNumber);
      sids.push(item.id);
    });
    res.status(200).json({
      contact: {
        primaryContatctId: parentId,
        emails: [...emails],
        phoneNumbers: [...phoneNumbers],
        secondaryContactIds: sids,
      },
    });
  } catch (error) {
    console.log(error);
    res.json({ message: error.message });
  }
};
